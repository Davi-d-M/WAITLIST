import java.net.URI

plugins {
    id("com.android.application")
}

val waitlistSiteUrl = providers.gradleProperty("waitlistSiteUrl").orElse("").get().trimEnd('/')

if (waitlistSiteUrl.isNotEmpty()) {
    val siteUri = try {
        URI(waitlistSiteUrl)
    } catch (error: Exception) {
        throw GradleException("waitlistSiteUrl must be the HTTPS origin of the deployed standalone waitlist site.", error)
    }
    if (siteUri.scheme != "https" || siteUri.host == null || siteUri.userInfo != null
        || siteUri.path.isNotEmpty() || siteUri.query != null || siteUri.fragment != null) {
        throw GradleException("waitlistSiteUrl must be the HTTPS origin of the deployed standalone waitlist site.")
    }
}
val escapedWaitlistSiteUrl = waitlistSiteUrl
    .replace("\\", "\\\\")
    .replace("\"", "\\\"")

android {
    namespace = "com.onlinebar.waitlist"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.onlinebar.waitlist"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
        buildConfigField("String", "WAITLIST_SITE_URL", "\"$escapedWaitlistSiteUrl\"")
    }

    buildFeatures {
        buildConfig = true
    }
}
