package com.onlinebar.waitlist;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import android.widget.TextView;

public final class MainActivity extends Activity {
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (BuildConfig.WAITLIST_SITE_URL.isEmpty()) {
            TextView configurationError = new TextView(this);
            configurationError.setText("Set the deployed waitlist URL with -PwaitlistSiteUrl=https://your-waitlist-domain before building this app.");
            configurationError.setPadding(48, 48, 48, 48);
            setContentView(configurationError);
            return;
        }
        webView = new WebView(this);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setAllowFileAccess(false);
        webView.getSettings().setAllowContentAccess(false);
        webView.addJavascriptInterface(new WaitlistBridge(), "OnlineBarNative");
        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                Uri site = Uri.parse(BuildConfig.WAITLIST_SITE_URL);
                if (site.getHost() != null && site.getHost().equalsIgnoreCase(uri.getHost())
                        && "https".equalsIgnoreCase(uri.getScheme())
                        && (site.getPort() == uri.getPort() || (site.getPort() == -1 && uri.getPort() == 443))) {
                    return false;
                }
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (ActivityNotFoundException error) {
                    Toast.makeText(MainActivity.this, "No app can open this link.", Toast.LENGTH_SHORT).show();
                }
                return true;
            }
        });
        setContentView(webView);
        webView.loadUrl(BuildConfig.WAITLIST_SITE_URL);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    public final class WaitlistBridge {
        @JavascriptInterface
        public void saveMemberProgress(String referralCode, String memberToken, String ageGroup) {
            if (referralCode == null || !referralCode.matches("(?i)[a-z0-9-]{4,40}")) return;
            if (memberToken == null || !memberToken.matches("[A-Za-z0-9_-]{43}")) return;
            getSharedPreferences(WaitlistWidgetProvider.PREFERENCES, MODE_PRIVATE)
                    .edit()
                    .putString(WaitlistWidgetProvider.REFERRAL_CODE, referralCode)
                    .putString(WaitlistWidgetProvider.MEMBER_TOKEN, memberToken)
                    .putString(WaitlistWidgetProvider.AGE_GROUP, ageGroup)
                    .apply();
            WaitlistWidgetProvider.requestRefresh(MainActivity.this);
        }
    }
}
