package providers

import (
	"testing"
	"time"

	providerUtils "github.com/maximhq/bifrost/core/providers/utils"
	bfschemas "github.com/maximhq/bifrost/core/schemas"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/valyala/fasthttp"

	"github.com/langwatch/langwatch/services/aigateway/domain"
)

// Providers the gateway sends self-hosted and hosted traffic to. VLLM is the
// OpenAI-compat path for any credential with a base_url (see mapProvider).
var privateNetworkProviders = []bfschemas.ModelProvider{
	bfschemas.VLLM,
	bfschemas.OpenAI,
	bfschemas.Anthropic,
	bfschemas.Azure,
}

func TestNewBifrostAccountAllowsPrivateNetworkOnlyWhenLocalCallsAreNotBlocked(t *testing.T) {
	t.Parallel()

	for _, test := range []struct {
		name                string
		blockLocalHTTPCalls bool
		wantAllowPrivate    bool
	}{
		{name: "self-hosted allows local calls", blockLocalHTTPCalls: false, wantAllowPrivate: true},
		{name: "hosted blocks local calls", blockLocalHTTPCalls: true, wantAllowPrivate: false},
	} {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			a := newBifrostAccount(BifrostOptions{BlockLocalHTTPCalls: test.blockLocalHTTPCalls}, nil)
			assert.Equal(t, test.wantAllowPrivate, a.allowPrivateNetwork)
		})
	}
}

func TestGetConfigForProviderAllowsPrivateNetworkWhenLocalCallsAllowed(t *testing.T) {
	t.Parallel()

	a := newBifrostAccount(BifrostOptions{BlockLocalHTTPCalls: false}, nil)
	for _, provider := range privateNetworkProviders {
		cfg, err := a.GetConfigForProvider(provider)
		require.NoError(t, err)
		assert.True(t, cfg.NetworkConfig.AllowPrivateNetwork,
			"provider %s: bifrost >=1.5 refuses RFC 1918 dials unless this is set, so LAN endpoints the gateway policy allows would fail", provider)
	}
}

func TestGetConfigForProviderKeepsPrivateNetworkBlockedWhenLocalCallsBlocked(t *testing.T) {
	t.Parallel()

	a := newBifrostAccount(BifrostOptions{BlockLocalHTTPCalls: true}, nil)
	for _, provider := range privateNetworkProviders {
		cfg, err := a.GetConfigForProvider(provider)
		require.NoError(t, err)
		assert.False(t, cfg.NetworkConfig.AllowPrivateNetwork,
			"provider %s: hosted mode must keep bifrost's RFC 1918 dial block as a second layer", provider)
	}
}

// URL-derived providers take a separate branch in GetConfigForProvider; the
// flag must reach them too.
func TestGetConfigForProviderAppliesPrivateNetworkPolicyToURLDerivedProviders(t *testing.T) {
	t.Parallel()

	for _, blockLocal := range []bool{false, true} {
		reg := newAnthropicCompatRegistry(anthropicCompatMaxEndpoints)
		provider := reg.register(domain.Credential{
			ProviderID: domain.ProviderAnthropic,
			APIKey:     "sk-ant",
			Extra:      map[string]string{"base_url": "http://192.168.15.101:8080/v1"},
		})
		a := newBifrostAccount(BifrostOptions{BlockLocalHTTPCalls: blockLocal}, reg)

		cfg, err := a.GetConfigForProvider(provider)
		require.NoError(t, err)
		assert.Equal(t, !blockLocal, cfg.NetworkConfig.AllowPrivateNetwork,
			"BlockLocalHTTPCalls=%v", blockLocal)
	}
}

// Pins the bifrost dialer contract this fix relies on, using the flag value
// GetConfigForProvider produces. A loopback httptest server cannot prove it:
// bifrost always allows loopback. So this dials an RFC 1918 address directly.
// The blocked case fails before any packet leaves. The allowed case only
// checks the policy error is gone; the dial itself may time out or be
// refused, which is fine.
func TestBifrostDialerFollowsAllowPrivateNetworkFromGatewayConfig(t *testing.T) {
	t.Parallel()

	const privateAddr = "10.255.255.1:9"
	const policyRefusal = "connection to private IP 10.255.255.1 is not allowed"

	for _, test := range []struct {
		name          string
		blockLocal    bool
		wantRefusePol bool
	}{
		{name: "blocked by bifrost when gateway blocks local calls", blockLocal: true, wantRefusePol: true},
		{name: "dialed when gateway allows local calls", blockLocal: false, wantRefusePol: false},
	} {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			a := newBifrostAccount(BifrostOptions{BlockLocalHTTPCalls: test.blockLocal}, nil)
			cfg, err := a.GetConfigForProvider(bfschemas.VLLM)
			require.NoError(t, err)

			client := providerUtils.ConfigureDialer(
				&fasthttp.Client{ReadTimeout: 50 * time.Millisecond},
				cfg.NetworkConfig.AllowPrivateNetwork,
			)
			conn, dialErr := client.Dial(privateAddr)
			if conn != nil {
				_ = conn.Close()
			}

			if test.wantRefusePol {
				require.Error(t, dialErr)
				assert.Contains(t, dialErr.Error(), policyRefusal)
				return
			}
			if dialErr != nil {
				assert.NotContains(t, dialErr.Error(), "is not allowed")
			}
		})
	}
}

// Link-local stays blocked by bifrost even with private egress on. The
// gateway relies on that (plus endpointAddressError) for cloud metadata.
func TestBifrostDialerStillBlocksLinkLocalWithPrivateNetworkAllowed(t *testing.T) {
	t.Parallel()

	a := newBifrostAccount(BifrostOptions{BlockLocalHTTPCalls: false}, nil)
	cfg, err := a.GetConfigForProvider(bfschemas.VLLM)
	require.NoError(t, err)
	require.True(t, cfg.NetworkConfig.AllowPrivateNetwork)

	client := providerUtils.ConfigureDialer(
		&fasthttp.Client{ReadTimeout: 200 * time.Millisecond},
		cfg.NetworkConfig.AllowPrivateNetwork,
	)
	conn, dialErr := client.Dial("169.254.169.254:80")
	if conn != nil {
		_ = conn.Close()
	}
	require.Error(t, dialErr)
	assert.Contains(t, dialErr.Error(), "link-local")
}
