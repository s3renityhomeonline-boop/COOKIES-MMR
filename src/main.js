import { Actor } from 'apify';
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Add stealth plugin
chromium.use(StealthPlugin());

// ============================================
// HUMAN-LIKE BEHAVIOR HELPERS
// ============================================

// Add random jitter to make patterns less predictable
function jitter() {
    return Math.floor(Math.random() * 80) - 40; // -40 to +40 random offset
}

async function humanDelay(min = 1000, max = 3000) {
    const baseDelay = Math.random() * (max - min) + min;
    const delay = baseDelay + jitter(); // Add jitter to delay
    await new Promise(resolve => setTimeout(resolve, Math.max(100, delay))); // Min 100ms
}

async function simulateHumanMouse(page) {
    // More variable mouse positions with jitter
    const baseX = Math.floor(Math.random() * 600) + 50;
    const baseY = Math.floor(Math.random() * 600) + 50;
    const x = baseX + jitter();
    const y = baseY + jitter();

    // Variable number of steps (8-15 instead of always 10)
    const steps = Math.floor(Math.random() * 8) + 8;

    await page.mouse.move(x, y, { steps });
    await humanDelay(300, 800);
}

async function simulateHumanScroll(page) {
    // More variable scroll amounts with jitter
    const baseScroll = Math.floor(Math.random() * 400) + 150;
    const scrollAmount = baseScroll + jitter();

    await page.evaluate((amount) => {
        window.scrollBy({
            top: amount,
            behavior: 'smooth'
        });
    }, scrollAmount);
    await humanDelay(500, 1000);
}

// ============================================
// CAPTCHA & ERROR DETECTION
// ============================================

async function detectCaptchaOrBlocking(page, pageName = 'page') {
    console.log(`  → Checking for CAPTCHA/blocking on ${pageName}...`);

    const blockingStatus = await page.evaluate(() => {
        const text = document.body.textContent.toLowerCase();
        const html = document.documentElement.innerHTML.toLowerCase();

        return {
            hasCaptcha: text.includes('captcha') ||
                       text.includes('verify you are human') ||
                       text.includes('verify you\'re human'),
            hasRecaptcha: !!document.querySelector('.g-recaptcha') ||
                         !!document.querySelector('[data-sitekey]') ||
                         html.includes('recaptcha'),
            hasCloudflare: text.includes('cloudflare') ||
                          text.includes('checking your browser') ||
                          text.includes('challenge'),
            hasAccessDenied: text.includes('access denied') ||
                           text.includes('403 forbidden') ||
                           text.includes('not authorized'),
            hasSessionExpired: text.includes('session expired') ||
                             text.includes('please log in') ||
                             text.includes('login required'),
            hasRateLimit: text.includes('too many requests') ||
                         text.includes('rate limit')
        };
    });

    // Report findings
    if (blockingStatus.hasCaptcha) {
        console.log('  ⚠️ CAPTCHA challenge detected!');
    }
    if (blockingStatus.hasRecaptcha) {
        console.log('  ⚠️ reCAPTCHA widget found!');
    }
    if (blockingStatus.hasCloudflare) {
        console.log('  ⚠️ Cloudflare challenge detected!');
    }
    if (blockingStatus.hasAccessDenied) {
        console.log('  ⚠️ Access denied message detected!');
    }
    if (blockingStatus.hasSessionExpired) {
        console.log('  ⚠️ Session expired - cookies need refresh!');
    }
    if (blockingStatus.hasRateLimit) {
        console.log('  ⚠️ Rate limit detected - slow down requests!');
    }

    const isBlocked = Object.values(blockingStatus).some(v => v);

    if (!isBlocked) {
        console.log(`  ✅ No blocking detected on ${pageName}`);
    }

    return blockingStatus;
}

// ============================================
// MAIN COOKIE REFRESHER
// ============================================

await Actor.main(async () => {
    const input = await Actor.getInput();

    const {
        manheimCookies = [],
        cookieWebhookUrl = 'https://n8n-production-0d7d.up.railway.app/webhook/mmrcookies',
        proxyConfiguration = {
            useApifyProxy: false
        }
    } = input;

    console.log('🍪 Starting Manheim Cookie Refresher...');
    console.log(`📤 Webhook URL: ${cookieWebhookUrl}`);

    // Validate inputs
    if (!manheimCookies || manheimCookies.length === 0) {
        throw new Error('❌ manheimCookies is required! Please provide yesterday\'s Manheim session cookies.');
    }

    if (!cookieWebhookUrl) {
        throw new Error('❌ cookieWebhookUrl is required! Please provide your webhook URL for cookie delivery.');
    }

    console.log(`\n🍪 Input cookies: ${manheimCookies.length} cookies loaded`);

    // Log cookie details
    const cookiesByDomain = {};
    manheimCookies.forEach(cookie => {
        if (!cookiesByDomain[cookie.domain]) {
            cookiesByDomain[cookie.domain] = [];
        }
        cookiesByDomain[cookie.domain].push(cookie.name);
    });

    Object.entries(cookiesByDomain).forEach(([domain, names]) => {
        console.log(`  → ${domain}: ${names.join(', ')}`);
    });

    // Setup proxy configuration
    let proxyUrl = null;
    if (proxyConfiguration && proxyConfiguration.useApifyProxy) {
        const proxyConfig = await Actor.createProxyConfiguration(proxyConfiguration);
        proxyUrl = await proxyConfig.newUrl();

        console.log('\n🌍 Proxy Configuration:');
        console.log(`  ✅ Country: ${proxyConfiguration.apifyProxyCountry}`);
        console.log(`  ✅ Groups: ${proxyConfiguration.apifyProxyGroups.join(', ')}`);
        console.log(`  ✅ Proxy URL: ${proxyUrl.substring(0, 50)}...`);
    } else {
        console.log('\n🌍 No proxy - using direct connection');
    }

    // Launch browser with stealth
    const browser = await chromium.launch({
        headless: true,
        args: [
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-web-security',
        ],
    });

    const contextOptions = {
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        locale: 'en-CA', // Canadian locale
        timezoneId: 'America/Edmonton', // Alberta, Canada timezone (Mountain Time)
    };

    // Only add proxy if configured
    if (proxyUrl) {
        contextOptions.proxy = { server: proxyUrl };
    }

    const context = await browser.newContext(contextOptions);

    // Set default navigation timeout
    context.setDefaultNavigationTimeout(90000);

    // Inject yesterday's cookies BEFORE navigating
    console.log('\n🍪 Injecting yesterday\'s cookies...');
    await context.addCookies(manheimCookies);
    console.log('  ✅ Cookies injected successfully');

    const page = await context.newPage();

    try {
        // STEP 1: Visit Manheim homepage to trigger session refresh
        console.log('\n🌐 STEP 1: Visiting Manheim homepage...');
        console.log('  → Navigating to: https://www.manheim.com/');

        await page.goto('https://www.manheim.com/', {
            waitUntil: 'domcontentloaded',
            timeout: 90000
        });
        console.log('  ✅ Page loaded (domcontentloaded)');

        console.log('  → Waiting 4-6 seconds for page to fully load...');
        await humanDelay(4000, 6000);

        // Check for CAPTCHA or blocking
        const homeBlocking = await detectCaptchaOrBlocking(page, 'Manheim home');
        if (homeBlocking.hasCaptcha || homeBlocking.hasRecaptcha || homeBlocking.hasCloudflare) {
            console.error('\n❌ CAPTCHA or challenge detected on home page!');
            const screenshot = await page.screenshot({ fullPage: false });
            await Actor.setValue('captcha-detected-screenshot', screenshot, { contentType: 'image/png' });
            throw new Error('CAPTCHA challenge detected - cannot proceed automatically');
        }
        if (homeBlocking.hasSessionExpired) {
            console.error('\n❌ Session expired detected!');
            throw new Error('Yesterday\'s cookies expired - please extract fresh cookies manually');
        }

        console.log('✅ Manheim homepage loaded successfully');

        // STEP 2: Simulate human activity
        console.log('\n🖱️ STEP 2: Simulating human activity...');
        console.log('  → Mouse movement...');
        await simulateHumanMouse(page);
        await humanDelay(1000, 2000);

        console.log('  → Scrolling...');
        await simulateHumanScroll(page);
        await humanDelay(1000, 2000);

        console.log('  → More mouse movement...');
        await simulateHumanMouse(page);
        await humanDelay(1000, 2000);

        console.log('✅ Human activity simulated');

        // STEP 3: Access MMR tool to ensure full cookie refresh
        console.log('\n📊 STEP 3: Accessing MMR tool to refresh cookies...');
        console.log('  → Simulating mouse movement...');
        await simulateHumanMouse(page);
        await humanDelay(1000, 2000);

        let mmrPage = null;

        // Try clicking button first (human-like behavior)
        try {
            console.log('  → Checking for iframes...');
            const frames = page.frames();
            console.log(`  → Found ${frames.length} frames`);

            // Look for header iframe
            let headerFrame = null;
            for (const frame of frames) {
                const url = frame.url();
                console.log(`  → Frame URL: ${url}`);
                if (url.includes('mcom-header-footer')) {
                    headerFrame = frame;
                    console.log('  ✅ Found header/footer iframe!');
                    break;
                }
            }

            // Decide where to click based on iframe detection
            let clickTarget;
            if (headerFrame) {
                console.log('  → Attempting to click MMR button inside iframe...');
                clickTarget = headerFrame.locator('[data-test-id="mmr-btn"]').first();
            } else {
                console.log('  → Attempting to click MMR button on main page...');
                clickTarget = page.locator('[data-test-id="mmr-btn"]').first();
            }

            // Wait for button to be visible
            await clickTarget.waitFor({ state: 'visible', timeout: 10000 });
            console.log('  ✅ MMR button is visible');

            // Set up BOTH popup AND navigation listeners (race condition)
            const popupPromise = context.waitForEvent('page', {
                predicate: (p) => p.url().includes('mmr.manheim.com'),
                timeout: 10000
            }).catch(() => null);

            const navigationPromise = page.waitForNavigation({
                url: /mmr\.manheim\.com/,
                waitUntil: 'domcontentloaded',
                timeout: 10000
            }).catch(() => null);

            // Click button with hover first (more human-like)
            await clickTarget.hover();
            await humanDelay(300, 600);
            await clickTarget.click({ timeout: 10000 });
            console.log('  ✅ MMR button clicked');

            // Wait for EITHER popup OR same-tab navigation
            console.log('  → Waiting for MMR tool to open (popup or navigation)...');
            const result = await Promise.race([popupPromise, navigationPromise]);

            // Check if we got a new popup page (has url() method) or same-tab navigation
            if (result && typeof result.url === 'function') {
                // New popup opened
                mmrPage = result;
                console.log(`  ✅ Popup opened successfully: ${mmrPage.url()}`);
            } else {
                // Same-tab navigation occurred (or both timed out, but page might have navigated)
                mmrPage = page;
                console.log(`  ✅ Navigated in same tab: ${mmrPage.url()}`);
            }

        } catch (error) {
            console.log(`  ⚠️ Button/popup approach failed: ${error.message}`);
            console.log('  → Fallback: Opening MMR tool directly...');

            // Fallback: Navigate directly to MMR tool
            mmrPage = await context.newPage();
            await mmrPage.goto('https://mmr.manheim.com/ui-mmr/?country=US&popup=true&source=man', {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });
            console.log('  ✅ MMR tool loaded via direct navigation');
        }

        // Verify we have MMR page
        if (!mmrPage) {
            console.error('\n❌ Failed to open MMR tool!');
            const screenshot = await page.screenshot({ fullPage: false });
            await Actor.setValue('mmr-failed-screenshot', screenshot, { contentType: 'image/png' });
            throw new Error('Could not access MMR tool - both button click and direct navigation failed');
        }

        console.log(`✅ MMR page ready: ${mmrPage.url()}`);

        // Wait for page to fully load
        console.log('  → Waiting for page to load...');
        await mmrPage.waitForLoadState('domcontentloaded');
        await humanDelay(3000, 5000);

        console.log('✅ MMR tool loaded successfully');

        // Check for CAPTCHA on MMR page
        const mmrBlocking = await detectCaptchaOrBlocking(mmrPage, 'MMR tool');
        if (mmrBlocking.hasCaptcha || mmrBlocking.hasRecaptcha || mmrBlocking.hasCloudflare) {
            console.error('\n❌ CAPTCHA or challenge detected on MMR page!');
            const screenshot = await mmrPage.screenshot({ fullPage: false });
            await Actor.setValue('mmr-captcha-screenshot', screenshot, { contentType: 'image/png' });
            throw new Error('CAPTCHA on MMR tool - cannot proceed automatically');
        }

        // STEP 4: More human activity on MMR page
        console.log('\n🖱️ STEP 4: Simulating human activity on MMR page...');
        console.log('  → Mouse movement...');
        await simulateHumanMouse(mmrPage);
        await humanDelay(1500, 2500);

        console.log('  → Scrolling...');
        await simulateHumanScroll(mmrPage);
        await humanDelay(1500, 2500);

        console.log('  → Final mouse movement...');
        await simulateHumanMouse(mmrPage);
        await humanDelay(1000, 2000);

        console.log('✅ Human activity completed on MMR page');

        // STEP 5: Navigate back to Manheim homepage to trigger full cookie refresh
        console.log('\n🔙 STEP 5: Navigating back to Manheim homepage...');
        console.log('  → This ensures all cookies are fully refreshed across both domains');

        // Use the main page (not mmrPage popup)
        await page.goto('https://www.manheim.com/', {
            waitUntil: 'domcontentloaded',
            timeout: 90000
        });
        console.log('  ✅ Returned to Manheim homepage');

        console.log('  → Waiting 3-5 seconds for cookies to settle...');
        await humanDelay(3000, 5000);

        // Hard refresh to force server to issue fresh cookies
        console.log('  → Performing hard refresh (Ctrl+F5) to get fresh cookies...');
        await page.reload({ waitUntil: 'domcontentloaded' });
        console.log('  ✅ Hard refresh completed');

        console.log('  → Waiting 3-5 seconds after refresh...');
        await humanDelay(3000, 5000);

        // More human activity on homepage
        console.log('  → Simulating human activity on homepage...');
        await simulateHumanMouse(page);
        await humanDelay(1000, 2000);

        await simulateHumanScroll(page);
        await humanDelay(1000, 2000);

        await simulateHumanMouse(page);
        await humanDelay(1000, 2000);

        console.log('✅ Back on Manheim homepage - cookies should be fully refreshed');

        // STEP 6: Extract fresh cookies from browser context
        console.log('\n🍪 STEP 6: Extracting fresh cookies...');

        const allCookies = await context.cookies();
        console.log(`  → Total cookies in browser: ${allCookies.length}`);

        // Filter for the 4 essential cookies
        const essentialCookies = {
            '_cl': null,
            'SESSION': null,
            'session': null,
            'session.sig': null
        };

        const targetDomains = {
            '_cl': '.manheim.com',
            'SESSION': '.manheim.com',
            'session': 'mcom-header-footer.manheim.com',
            'session.sig': 'mcom-header-footer.manheim.com'
        };

        // Extract matching cookies
        allCookies.forEach(cookie => {
            if (essentialCookies.hasOwnProperty(cookie.name)) {
                const expectedDomain = targetDomains[cookie.name];
                if (cookie.domain === expectedDomain) {
                    essentialCookies[cookie.name] = cookie;
                    console.log(`  ✅ Found: ${cookie.name} (${cookie.domain})`);
                }
            }
        });

        // Verify all 4 cookies were found
        const missingCookies = [];
        Object.keys(essentialCookies).forEach(name => {
            if (!essentialCookies[name]) {
                missingCookies.push(name);
                console.log(`  ❌ Missing: ${name}`);
            }
        });

        if (missingCookies.length > 0) {
            console.error(`\n❌ Failed to extract all cookies. Missing: ${missingCookies.join(', ')}`);

            // Save all cookies for debugging
            await Actor.setValue('all-cookies-debug', allCookies);
            console.log('  → All cookies saved to key-value store for debugging');

            throw new Error(`Missing cookies: ${missingCookies.join(', ')}`);
        }

        console.log('\n✅ All 4 essential cookies extracted successfully!');

        // STEP 7: Prepare webhook payload
        console.log('\n📤 STEP 7: Preparing webhook payload...');

        const cookieArray = [
            essentialCookies['_cl'],
            essentialCookies['SESSION'],
            essentialCookies['session'],
            essentialCookies['session.sig']
        ];

        const webhookPayload = {
            success: true,
            timestamp: new Date().toISOString(),
            cookies: cookieArray,
            cookieDetails: {
                _cl: {
                    found: true,
                    domain: essentialCookies['_cl'].domain,
                    expires: essentialCookies['_cl'].expires || 'session'
                },
                SESSION: {
                    found: true,
                    domain: essentialCookies['SESSION'].domain,
                    expires: essentialCookies['SESSION'].expires || 'session'
                },
                session: {
                    found: true,
                    domain: essentialCookies['session'].domain,
                    expires: essentialCookies['session'].expires || 'session'
                },
                'session.sig': {
                    found: true,
                    domain: essentialCookies['session.sig'].domain,
                    expires: essentialCookies['session.sig'].expires || 'session'
                }
            }
        };

        console.log('  → Payload prepared');
        console.log('  → Cookie count: 4');
        console.log('  → Timestamp:', webhookPayload.timestamp);

        // STEP 8: Send to webhook
        console.log('\n📤 STEP 8: Sending cookies to webhook...');
        console.log(`  → URL: ${cookieWebhookUrl}`);

        const webhookResponse = await fetch(cookieWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(webhookPayload)
        });

        if (webhookResponse.ok) {
            console.log(`  ✅ Webhook sent successfully (${webhookResponse.status})`);
            const responseText = await webhookResponse.text();
            if (responseText) {
                console.log(`  → Response: ${responseText}`);
            }
        } else {
            console.log(`  ⚠️ Webhook failed (${webhookResponse.status})`);
            const errorText = await webhookResponse.text();
            console.log(`  → Error: ${errorText}`);
            throw new Error(`Webhook failed with status ${webhookResponse.status}`);
        }

        // STEP 9: Save cookies to Apify KV store as backup
        console.log('\n💾 STEP 9: Saving cookies to Apify KV store (backup)...');
        await Actor.setValue('fresh-cookies', webhookPayload);
        console.log('  ✅ Cookies saved to key-value store');

        // STEP 10: Summary
        console.log('\n' + '='.repeat(60));
        console.log('✅ COOKIE REFRESH COMPLETED SUCCESSFULLY');
        console.log('='.repeat(60));
        console.log('📊 Summary:');
        console.log('  • Cookies extracted: 4/4');
        console.log('  • Webhook delivery: ✅ Success');
        console.log('  • Backup saved: ✅ Yes');
        console.log('  • Timestamp:', webhookPayload.timestamp);
        console.log('='.repeat(60) + '\n');

    } catch (error) {
        console.error('\n❌ Fatal error:', error.message);

        // Send failure notification to webhook
        try {
            const failurePayload = {
                success: false,
                timestamp: new Date().toISOString(),
                error: error.message,
                cookies: null
            };

            await fetch(cookieWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(failurePayload)
            });

            console.log('  → Failure notification sent to webhook');
        } catch (webhookError) {
            console.error('  → Failed to send failure notification:', webhookError.message);
        }

        throw error;
    } finally {
        await browser.close();
        console.log('🍪 Cookie refresher completed!');
    }
});
