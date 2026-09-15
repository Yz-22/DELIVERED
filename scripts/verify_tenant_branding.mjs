import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

async function runVerification() {
  console.log('=============== STARTING TENANT BRANDING VERIFICATION TESTS ===============\n');

  let testPassedCount = 0;
  let testFailedCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      testPassedCount++;
    } else {
      console.error(`[FAIL] ${message}`);
      testFailedCount++;
    }
  }

  const superToken = 'u-super-1'; // Seeded SUPER_ADMIN user ID in server.ts

  try {
    // 0. Seed test users via API with valid UUIDs
    const basilAdminId = '11111111-1111-4111-8111-111111111111';
    const waseemAdminId = '22222222-2222-4222-8222-222222222222';
    const merchantBasilId = '33333333-3333-4333-8333-333333333333';

    // Create Admin Basil
    const basilCreateRes = await fetch(`${BASE_URL}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superToken}`,
      },
      body: JSON.stringify({
        id: basilAdminId,
        name: 'ADMIN Basil (DarGo)',
        email: `basil_${Date.now()}@dargo.jo`,
        phone: '079' + Math.floor(1000000 + Math.random() * 9000000),
        role: 'ADMIN',
        permissions: ['company.branding.manage'],
      }),
    });
    const basilUserData = await basilCreateRes.json();
    const realBasilId = basilUserData.user?.id || basilAdminId;

    // Create Admin Waseem
    const waseemCreateRes = await fetch(`${BASE_URL}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superToken}`,
      },
      body: JSON.stringify({
        id: waseemAdminId,
        name: 'ADMIN Waseem (Other Company)',
        email: `waseem_${Date.now()}@other.jo`,
        phone: '079' + Math.floor(1000000 + Math.random() * 9000000),
        role: 'ADMIN',
        permissions: ['company.branding.manage'],
      }),
    });
    const waseemUserData = await waseemCreateRes.json();
    const realWaseemId = waseemUserData.user?.id || waseemAdminId;

    // Create Merchant A belonging to Basil
    const merchantCreateRes = await fetch(`${BASE_URL}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superToken}`,
      },
      body: JSON.stringify({
        id: merchantBasilId,
        name: 'Merchant A (DarGo Sub-account)',
        email: `merchant_${Date.now()}@dargo.jo`,
        phone: '079' + Math.floor(1000000 + Math.random() * 9000000),
        role: 'MERCHANT',
        parentUserId: realBasilId,
        permissions: [], // NO branding manage permission
      }),
    });
    const merchantUserData = await merchantCreateRes.json();
    const realMerchantId = merchantUserData.user?.id || merchantBasilId;

    const basilToken = realBasilId;
    const waseemToken = realWaseemId;
    const merchantToken = realMerchantId;

    // TEST 1: Admin Basil updates company name and branding
    const basilBrandingPayload = {
      companyName: 'DarGo Express Logistics',
      logoUrl: 'https://dargo.jo/logo.png',
      phone: '0791111111',
      taxId: '100200300',
      address: 'Amman - Business Park',
    };

    const updateBasilRes = await fetch(`${BASE_URL}/api/company/branding`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${basilToken}`,
      },
      body: JSON.stringify(basilBrandingPayload),
    });

    assert(updateBasilRes.status === 200, 'TEST 1: Admin Basil can update company branding (200 OK)');
    const basilBrandingData = await updateBasilRes.json();
    assert(
      basilBrandingData.branding?.companyName === 'DarGo Express Logistics',
      'TEST 1: Returned updated company name for Admin Basil'
    );

    // TEST 2: Tenant Isolation - Fetch Waseem's branding as Waseem
    const waseemFetchRes = await fetch(`${BASE_URL}/api/company/branding`, {
      headers: { Authorization: `Bearer ${waseemToken}` },
    });
    assert(waseemFetchRes.status === 200, 'TEST 2: Admin Waseem can fetch own branding (200 OK)');
    const waseemBrandingData = await waseemFetchRes.json();
    assert(
      waseemBrandingData.branding?.companyName !== 'DarGo Express Logistics',
      'TEST 2: ISOLATION PASS - Admin Waseem does NOT see DarGo branding'
    );

    // TEST 3: Spoofed Tenant ID Attack Prevention
    // Basil attempts to pass Waseem's tenant ID in req.body to alter Waseem's branding
    const spoofAttackRes = await fetch(`${BASE_URL}/api/company/branding`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${basilToken}`,
      },
      body: JSON.stringify({
        tenantId: realWaseemId, // Spoofed target
        companyName: 'WASEEM_HACK_ATTEMPT',
      }),
    });
    assert(spoofAttackRes.status === 200, 'TEST 3: Spoof request processed without crash');
    const waseemFetchAfterSpoof = await fetch(`${BASE_URL}/api/company/branding`, {
      headers: { Authorization: `Bearer ${waseemToken}` },
    });
    const waseemDataAfterSpoof = await waseemFetchAfterSpoof.json();
    assert(
      waseemDataAfterSpoof.branding?.companyName !== 'WASEEM_HACK_ATTEMPT',
      'TEST 3: ISOLATION SECURITY PASS - Client tenantId override was ignored by backend!'
    );

    // Reset Basil's branding after spoof test
    await fetch(`${BASE_URL}/api/company/branding`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${basilToken}`,
      },
      body: JSON.stringify(basilBrandingPayload),
    });

    // TEST 4: Sub-account fetches parent company branding
    const merchantFetchRes = await fetch(`${BASE_URL}/api/company/branding`, {
      headers: { Authorization: `Bearer ${merchantToken}` },
    });
    assert(merchantFetchRes.status === 200, 'TEST 4: Merchant A can fetch company branding (200 OK)');
    const merchantBrandingData = await merchantFetchRes.json();
    assert(
      merchantBrandingData.branding?.companyName === 'DarGo Express Logistics',
      'TEST 4: Merchant A automatically inherits parent Admin Basil branding!'
    );

    // TEST 5: Sub-account unauthorized update attempt
    const merchantUpdateRes = await fetch(`${BASE_URL}/api/company/branding`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${merchantToken}`,
      },
      body: JSON.stringify({ companyName: 'Merchant Attempted Name' }),
    });
    assert(
      merchantUpdateRes.status === 403,
      'TEST 5: Merchant A without company.branding.manage permission gets 403 FORBIDDEN'
    );

    // TEST 6: Sub-account logo upload unauthorized attempt
    const merchantLogoRes = await fetch(`${BASE_URL}/api/company/branding/logo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${merchantToken}`,
      },
      body: JSON.stringify({ imageBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' }),
    });
    assert(
      merchantLogoRes.status === 403,
      'TEST 6: Merchant logo upload attempt rejected with 403 FORBIDDEN'
    );

    // TEST 7: Valid Logo Upload by Admin Basil
    const validPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const basilLogoRes = await fetch(`${BASE_URL}/api/company/branding/logo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${basilToken}`,
      },
      body: JSON.stringify({
        imageBase64: validPngBase64,
        fileName: 'logo.png',
        mimeType: 'image/png',
      }),
    });
    assert(basilLogoRes.status === 200, 'TEST 7: Admin Basil can upload valid PNG logo (200 OK)');
    const logoData = await basilLogoRes.json();
    assert(
      logoData.success && typeof logoData.logoUrl === 'string' && logoData.logoUrl.length > 0,
      'TEST 7: Valid logoUrl returned from upload endpoint'
    );

    // TEST 8: File Size Limit Validation (> 5MB)
    const hugeBuffer = Buffer.alloc(5.5 * 1024 * 1024, 'a').toString('base64');
    const hugeLogoRes = await fetch(`${BASE_URL}/api/company/branding/logo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${basilToken}`,
      },
      body: JSON.stringify({
        imageBase64: hugeBuffer,
        fileName: 'huge.png',
        mimeType: 'image/png',
      }),
    });
    assert(hugeLogoRes.status === 400, 'TEST 8: Logo exceeding 5MB rejected with 400 BAD REQUEST');

    // TEST 9: Unsupported File Type Validation (.exe / application/x-msdownload)
    const exeRes = await fetch(`${BASE_URL}/api/company/branding/logo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${basilToken}`,
      },
      body: JSON.stringify({
        imageBase64: validPngBase64,
        fileName: 'malicious.exe',
        mimeType: 'application/x-msdownload',
      }),
    });
    assert(exeRes.status === 400, 'TEST 9: Unsupported file extension/mime rejected with 400 BAD REQUEST');

    // TEST 10: Malicious SVG Sanitization (Script injection)
    const maliciousSvg = `<svg xmlns="http://www.w3.org/2000/svg"><script>alert('xss')</script></svg>`;
    const svgBase64 = Buffer.from(maliciousSvg).toString('base64');
    const svgRes = await fetch(`${BASE_URL}/api/company/branding/logo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${basilToken}`,
      },
      body: JSON.stringify({
        imageBase64: svgBase64,
        fileName: 'vector.svg',
        mimeType: 'image/svg+xml',
      }),
    });
    assert(svgRes.status === 400, 'TEST 10: Malicious SVG containing <script> rejected with 400 BAD REQUEST');

    // TEST 11: SuperAdmin Override Capability
    const superOverrideRes = await fetch(`${BASE_URL}/api/company/branding`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superToken}`,
      },
      body: JSON.stringify({
        tenantId: realWaseemId,
        companyName: 'SuperAdmin Assigned Waseem Name',
      }),
    });
    assert(superOverrideRes.status === 200, 'TEST 11: SUPER_ADMIN can manage company branding for any tenant');

    console.log(`\n=============== VERIFICATION RESULTS: ${testPassedCount} PASSED, ${testFailedCount} FAILED ===============\n`);

  } catch (err) {
    console.error('Fatal error during verification:', err);
  }
}

runVerification();
