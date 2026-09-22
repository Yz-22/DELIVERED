import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Language = 'ar' | 'en';
export type Direction = 'rtl' | 'ltr';

export interface Translations {
  common: {
    appName: string;
    searchPlaceholder: string;
    scan: string;
    newOrder: string;
    quickOrder: string;
    save: string;
    cancel: string;
    close: string;
    refresh: string;
    actions: string;
    status: string;
    filter: string;
    clear: string;
    export: string;
    print: string;
    loading: string;
    noData: string;
    viewAll: string;
    details: string;
    edit: string;
    delete: string;
    confirm: string;
    back: string;
    language: string;
    logout: string;
    profile: string;
    allBranches: string;
    allMerchants: string;
    allDrivers: string;
  };
  navigation: {
    controlTower: string;
    orders: string;
    dispatch: string;
    liveMap: string;
    drivers: string;
    branches: string;
    manifests: string;
    returns: string;
    finance: string;
    merchants: string;
    reports: string;
    pricing: string;
    teamPermissions: string;
    automations: string;
    settings: string;
    pos: string;
    inventory: string;
  };
  controlTower: {
    title: string;
    subtitle: string;
    needsAttention: string;
    waitingPickup: string;
    atHub: string;
    readyForDispatch: string;
    outForDelivery: string;
    failedAttempts: string;
    postponed: string;
    returnsWaiting: string;
    unassigned: string;
    lateOrders: string;
    codIssues: string;
    activeFleet: string;
    cashInCustody: string;
    merchantPayables: string;
    recentActivity: string;
    operationalQueues: string;
    quickMetrics: string;
    fleetStatus: string;
    activeDrivers: string;
    offlineDrivers: string;
  };
  orders: {
    title: string;
    createTitle: string;
    quickCreateTitle: string;
    customerTotalToCollect: string;
    customerTotalHelper: string;
    deliveryFeeIncluded: string;
    customerName: string;
    customerPhone: string;
    secondaryPhone: string;
    governorate: string;
    area: string;
    address: string;
    parcelType: string;
    declaredValue: string;
    notes: string;
    merchantCollectionPreview: string;
    calculatedDeliveryFee: string;
    netMerchantCollection: string;
    trackingNumber: string;
    referenceNumber: string;
    merchant: string;
    driver: string;
    branch: string;
    drawerTabs: {
      overview: string;
      journey: string;
      timeline: string;
      customer: string;
      shipment: string;
      finance: string;
      pod: string;
      returns: string;
      tasks: string;
      audit: string;
    };
    journey: {
      title: string;
      origin: string;
      destination: string;
      currentCustody: string;
      firstMile: string;
      sortingHub: string;
      lastMile: string;
      responsibleParty: string;
      completedLeg: string;
      inProgressLeg: string;
      pendingLeg: string;
      unverifiedCustodyNotice: string;
      visualJourneyNotice: string;
      assignedDriver: string;
      unassignedDriver: string;
      mainHubName: string;
      outForDeliveryLeg: string;
      reverseLeg: string;
      expectedNextLocation: string;
    };
    timeline: {
      title: string;
      verifiedEventAudit: string;
      recordedEvents: string;
      noEvents: string;
      otpVerified: string;
      signed: string;
      assignedDriverLabel: string;
    };
    opsActions: {
      changeStatus: string;
      assignDriver: string;
      printWaybill: string;
      callCustomer: string;
      callMerchant: string;
      whatsappCustomer: string;
      whatsappMerchant: string;
      sendOtpSms: string;
      cliqPayment: string;
      openMap: string;
      copyPhone: string;
    };
  };
  driver: {
    collectFromCustomer: string;
    collectFromCustomerHelper: string;
    myEarning: string;
    cashCustody: string;
    activeTasks: string;
    onlineStatus: string;
    goOnline: string;
    goOffline: string;
    title: string;
    subtitle: string;
    vehicle: string;
    plate: string;
    cashInHand: string;
    refreshWorkload: string;
    inVehicleCustody: string;
    awaitingDepotRelease: string;
    deliveredToday: string;
    totalCodRemaining: string;
    tabActiveStops: string;
    tabMyLoad: string;
    tabCompleted: string;
    tabExceptions: string;
    tabCashLedger: string;
    priorityStopHeader: string;
    recipient: string;
    governorateArea: string;
    requiredCollection: string;
    prepaid: string;
    call: string;
    whatsapp: string;
    navigate: string;
    recordFailure: string;
    confirmDelivery: string;
    confirmDeliveryFinal: string;
    paymentMethod: string;
    cashCod: string;
    cliqTransfer: string;
    cliqRefPlaceholder: string;
    deliveryOtp: string;
    recipientSignature: string;
    clearSignature: string;
    deliveryNotes: string;
    failureReason: string;
    failureNotes: string;
    confirmFailure: string;
    noActiveStops: string;
    noActiveStopsSub: string;
    noCashRecords: string;
  };
  finance: {
    merchantCollection: string;
    deliveryFee: string;
    driverEarning: string;
    companyRevenue: string;
    netPayable: string;
    settlements: string;
    driverRemittance: string;
  };
  hub: {
    workspaceTitle: string;
    facilityContext: string;
    facilitySelect: string;
    scanWorkspaceTitle: string;
    hardwareScanPlaceholder: string;
    cameraScan: string;
    manualEntry: string;
    inboundReceiving: string;
    sortingQueue: string;
    manifestsWorkspace: string;
    dispatchRelease: string;
    exceptionsQueue: string;
    scanToIdentify: string;
    readyToScan: string;
    readyToScanDesc: string;
    identifiedParcel: string;
    allowedActions: string;
    confirmAction: string;
    recentActivity: string;
    incomingPackages: string;
    custodyPackages: string;
    readyDispatch: string;
    activeManifests: string;
    sealManifest: string;
    sealNumber: string;
    printManifest: string;
    createManifest: string;
    manifestType: string;
    destinationFacility: string;
    assignedDriver: string;
    notes: string;
    duplicateScanWarning: string;
    noAllowedActions: string;
    from: string;
    to: string;
    title: string;
    subtitle: string;
    currentFacility: string;
    refresh: string;
    scanAnythingBtn: string;
    tabInbound: string;
    parcelsCount: string;
    tabSorting: string;
    tabManifests: string;
    tabDispatch: string;
    readyCount: string;
    tabExceptions: string;
    fastIntakeTitle: string;
    fastIntakeSub: string;
    scanInputPlaceholder: string;
    confirmIntakeBtn: string;
    expectedQueueTitle: string;
    expectedQueueSub: string;
    expectedCount: string;
    colTracking: string;
    colSender: string;
    colRecipient: string;
    colRouteType: string;
    colLegStatus: string;
    colAction: string;
    noInbound: string;
    sortingTitle: string;
    sortingSub: string;
    noSorting: string;
    manifestsTitle: string;
    manifestsSub: string;
    createNewManifestBtn: string;
    manifestListTitle: string;
    noManifests: string;
    selectManifestPrompt: string;
    printManifestBtn: string;
    sealManifestBtn: string;
    scanToAddPlaceholder: string;
    addBtn: string;
    noManifestItems: string;
    dispatchTitle: string;
    dispatchSub: string;
    targetDriverLabel: string;
    selectDriverOption: string;
    scanDispatchPlaceholder: string;
    confirmReleaseBtn: string;
    readyDispatchTitle: string;
    noReadyDispatch: string;
    handoverBtn: string;
    exceptionsTitle: string;
    exceptionsSub: string;
    colRecommendedAction: string;
    noExceptions: string;
    createManifestModalTitle: string;
    manifestTypeLabel: string;
    driverRunsheetOpt: string;
    hubTransferOpt: string;
    destFacilityLabel: string;
    selectFacilityOption: string;
    notesLabel: string;
    createBtn: string;
    cancelBtn: string;
    sealModalTitle: string;
    sealModalSub: string;
    sealNumberLabel: string;
    confirmSealBtn: string;
    printModalTitle: string;
    printNowBtn: string;
    delivereLogisticsERP: string;
    signatureFacility: string;
    signatureDriver: string;
  };
  auth: {
    welcomeBack: string;
    signInToManage: string;
    signInTitle: string;
    signInSubtitle: string;
    identifierLabel: string;
    identifierPlaceholder: string;
    passwordLabel: string;
    passwordPlaceholder: string;
    showPassword: string;
    hidePassword: string;
    rememberMe: string;
    signInButton: string;
    signingIn: string;
    reconnecting: string;
    googleButton: string;
    orDivider: string;
    redeemInvitePrompt: string;
    redeemInviteInputPlaceholder: string;
    activateButton: string;
    cancelButton: string;
    microCopy: string;
    secureConnection: string;
    retry: string;
  };
}

const translations: Record<Language, Translations> = {
  ar: {
    common: {
      appName: 'ديليفري (Delivere)',
      searchPlaceholder: 'بحث سري بالرقم المرجعي، الهاتف، العميل، التتبع... (Ctrl+K)',
      scan: 'مسح باركود',
      newOrder: 'طلب جديد',
      quickOrder: 'طلب سريع',
      save: 'حفظ',
      cancel: 'إلغاء',
      close: 'إغلاق',
      refresh: 'تحديث',
      actions: 'إجراءات',
      status: 'الحالة',
      filter: 'تصفية',
      clear: 'مسح',
      export: 'تصدير',
      print: 'طباعة',
      loading: 'جاري التحميل...',
      noData: 'لا توجد بيانات متاحة',
      viewAll: 'عرض الكل',
      details: 'التفاصيل',
      edit: 'تعديل',
      delete: 'حذف',
      confirm: 'تأكيد',
      back: 'رجوع',
      language: 'اللغة / Language',
      logout: 'تسجيل الخروج',
      profile: 'الملف الشخصي',
      allBranches: 'جميع الفروع',
      allMerchants: 'جميع التجار',
      allDrivers: 'جميع السائقين',
    },
    navigation: {
      controlTower: 'برج التحكم اللوجستي',
      orders: 'إدارة الشحنات',
      dispatch: 'التوزيع والتوجيه (Dispatch)',
      liveMap: 'الخريطة الحية',
      drivers: 'إدارة السائقين والأسطول',
      branches: 'الفروع والمراكز (Hubs)',
      manifests: 'المانفيست والكشوفات',
      returns: 'المرتجعات والتسليم العكسي',
      finance: 'المقاصة والمالية',
      merchants: 'بوابة التجار (Merchants)',
      reports: 'التقارير والأداء',
      pricing: 'قوائم الأسعار',
      teamPermissions: 'الفريق والصلاحيات',
      automations: 'محرك الأتمتة',
      settings: 'إعدادات النظام',
      pos: 'نظام البيع (POS)',
      inventory: 'المخزون والمستودع',
    },
    controlTower: {
      title: 'برج التحكم اللوجستي (Control Tower)',
      subtitle: 'مراقبة فورية للعمليات، الشحنات الحرجة، حالة الأسطول، والتدفقات المالية',
      needsAttention: 'حالات تتطلب الإجراء الفوري',
      waitingPickup: 'بانتظار البيك أب',
      atHub: 'في مركز التجميع (Hub)',
      readyForDispatch: 'جاهزة للتوزيع',
      outForDelivery: 'خرجت للتسليم',
      failedAttempts: 'محاولات فاشلة',
      postponed: 'مؤجلة',
      returnsWaiting: 'مرتجعات قيد المعالجة',
      unassigned: 'بدون سائق',
      lateOrders: 'شحنات متأخرة',
      codIssues: 'فروقات التحصيل (COD)',
      activeFleet: 'نشاط الأسطول',
      cashInCustody: 'عهد نقدية لدى السائقين',
      merchantPayables: 'مستحقات التجار المعلقة',
      recentActivity: 'النشاط التشغيلي المباشر',
      operationalQueues: 'طوابير العمليات',
      quickMetrics: 'مؤشرات الأداء السريعة',
      fleetStatus: 'حالة الأسطول الميداني',
      activeDrivers: 'سائقين متصلين',
      offlineDrivers: 'سائقين غير متصلين',
    },
    orders: {
      title: 'جدول الشحنات والعمليات',
      createTitle: 'إنشاء شحنة جديدة',
      quickCreateTitle: 'إضافة شحنة سريعة',
      customerTotalToCollect: 'المبلغ المطلوب تحصيله من العميل',
      customerTotalHelper: 'شامل رسوم التوصيل',
      deliveryFeeIncluded: 'رسوم التوصيل محتسبة ومشمولة في المبلغ',
      customerName: 'اسم العميل المستلم',
      customerPhone: 'رقم هاتف العميل',
      secondaryPhone: 'رقم هاتف إضافي',
      governorate: 'المحافظة',
      area: 'المنطقة / الحي',
      address: 'العنوان التفصيلي',
      parcelType: 'نوع الطرد / المحتوى',
      declaredValue: 'القيمة المصرح بها',
      notes: 'ملاحظات الشحنة والتعليمات',
      merchantCollectionPreview: 'احتساب صافي التاجر المتوقع:',
      calculatedDeliveryFee: 'رسوم التوصيل المحتسبة:',
      netMerchantCollection: 'صافي تحصيل التاجر:',
      trackingNumber: 'رقم التتبع (Babel Code)',
      referenceNumber: 'الرقم المرجعي للتاجر',
      merchant: 'التاجر',
      driver: 'السائق المكلف',
      branch: 'الفرع المسؤول',
      drawerTabs: {
        overview: 'نظرة عامة',
        journey: 'مسار الشحنة',
        timeline: 'سجل التتبع',
        customer: 'بيانات العميل',
        shipment: 'تفاصيل الطرد',
        finance: 'التسوية المالية',
        pod: 'إثبات التسليم (POD)',
        returns: 'المرتجعات',
        tasks: 'المهام والتنبيهات',
        audit: 'سجل التدقيق',
      },
      journey: {
        title: 'مسار الشحنة التشغيلي (استدلالي)',
        origin: 'المصدر (المتجر)',
        destination: 'المستلم (الوجهة)',
        currentCustody: 'المرحلة التشغيلية والجهة المكلفة',
        firstMile: 'المرحلة الأولى: استلام وتجميع (First Mile)',
        sortingHub: 'المرحلة الثانية: مركز الفرز والتوزيع (Hub Operations)',
        lastMile: 'المرحلة الثالثة: التوصيل النهائي (Last Mile)',
        responsibleParty: 'الجهة التشغيلية المكلفة حالياً',
        completedLeg: 'مكتملة',
        inProgressLeg: 'قيد التنفيذ',
        pendingLeg: 'بانتظار البدء',
        unverifiedCustodyNotice: 'مرحلة تقديرية حسب حالة الطرد (لا يمثل سند استلام أو عهدة فعلية مؤكدة)',
        visualJourneyNotice: 'مسار تشغيلي استدلالي مشتق من حالة الطرد والسائق المكلف (لا توجد قيود أطراف متعددة منفصلة)',
        assignedDriver: 'الكابتن المكلف',
        unassignedDriver: 'لم يتم تعيين سائق بعد',
        mainHubName: 'مركز الفرز والترانزيت الرئيسي (Amman Hub)',
        outForDeliveryLeg: 'خرجت للتسليم الميداني',
        reverseLeg: 'تسليم عكسي للتاجر',
        expectedNextLocation: 'الوجهة التشغيلية المتوقعة',
      },
      timeline: {
        title: 'سجل التتبع والأحداث الزمنية',
        verifiedEventAudit: 'تدقيق زمني مسجل',
        recordedEvents: 'أحداث مسجلة',
        noEvents: 'لا يملك هذا الطرد سجل تغييرات أو أحداث زمني بعد.',
        otpVerified: 'تم التحقق برمز OTP',
        signed: 'توقيع معتمد',
        assignedDriverLabel: 'الكابتن المكلف',
      },
      opsActions: {
        changeStatus: 'تغيير حالة الشحنة',
        assignDriver: 'تعيين كابتن',
        printWaybill: 'طباعة البوليصة',
        callCustomer: 'اتصال بالعميل',
        callMerchant: 'اتصال بالتاجر',
        whatsappCustomer: 'واتساب المستلم',
        whatsappMerchant: 'واتساب التاجر',
        sendOtpSms: 'إرسال رمز OTP',
        cliqPayment: 'دفع CliQ',
        openMap: 'فتح الخريطة',
        copyPhone: 'نسخ الرقم',
      },
    },
    driver: {
      collectFromCustomer: 'المبلغ المطلوب تحصيله من العميل',
      collectFromCustomerHelper: 'يرجى تحصيل هذا المبلغ كاملاً شامل التوصيل',
      myEarning: 'عمولتي المستحقة',
      cashCustody: 'العهدة النقدية بحوزتي',
      activeTasks: 'المهام والطلبيات الحالية',
      onlineStatus: 'حالة الاتصال الميداني',
      goOnline: 'بدء الوردية / متصل',
      goOffline: 'إنهاء الوردية / غير متصل',
      title: 'كابتن الميدان والتوصيل',
      subtitle: 'Delivere Mobile Captain',
      vehicle: 'مركبة',
      plate: 'لوحة',
      cashInHand: 'العهدة النقدية بيدي الآن',
      refreshWorkload: 'تحديث المهام',
      inVehicleCustody: 'بحوزتي في المركبة',
      awaitingDepotRelease: 'بانتظار الاستلام من المستودع',
      deliveredToday: 'تم تسليمه اليوم',
      totalCodRemaining: 'تحصيل متبقي',
      tabActiveStops: 'التوقفات الحالية',
      tabMyLoad: 'حمولتي والعهدة',
      tabCompleted: 'المنجزة',
      tabExceptions: 'المتعذرة',
      tabCashLedger: 'العهدة النقدية',
      priorityStopHeader: 'المهمة الحالية الأولوية',
      recipient: 'المستلم',
      governorateArea: 'المنطقة',
      requiredCollection: 'المطلوب تحصيله',
      prepaid: 'مدفوع مسبقاً',
      call: 'اتصال',
      whatsapp: 'واتساب',
      navigate: 'الموقع',
      recordFailure: 'تعذر التسليم',
      confirmDelivery: 'تأكيد التسليم',
      confirmDeliveryFinal: 'تأكيد التسليم النهائي',
      paymentMethod: 'طريقة استلام المبلغ من العميل',
      cashCod: 'نقداً (كاش COD)',
      cliqTransfer: 'حوالة فورية CliQ',
      cliqRefPlaceholder: 'الرقم المرجعي للتحويل البنكي (CliQ Reference) *',
      deliveryOtp: 'رمز التسليم / OTP',
      recipientSignature: 'توقيع المستلم (إثبات تسليم)',
      clearSignature: 'مسح التوقيع',
      deliveryNotes: 'ملاحظات التسليم',
      failureReason: 'سبب تعذر التسليم *',
      failureNotes: 'تفاصيل وملاحظات إضافية',
      confirmFailure: 'تأكيد تسجيل التعذر',
      noActiveStops: 'لا توجد توقفات نشطة حالياً',
      noActiveStopsSub: 'تم تسليم جميع المهام المعينة لك أو لا يوجد طرود بحوزتك للتوصيل الآن.',
      noCashRecords: 'لا توجد سجلات تحصيل مسجلة.',
    },
    finance: {
      merchantCollection: 'صافي تحصيل التاجر',
      deliveryFee: 'رسوم التوصيل',
      driverEarning: 'عمولة السائق',
      companyRevenue: 'إيراد الشركة',
      netPayable: 'الصافي المستحق للتسديد',
      settlements: 'كشوفات كشف الحساب والرميتنس',
      driverRemittance: 'إغلاق وكسر العهد النقدية للسائقين',
    },
    hub: {
      workspaceTitle: 'مركز عمليات الفرز والمستودعات',
      facilityContext: 'سياق المستودع والفرز الحالي',
      facilitySelect: 'المستودع / المركز التشغيلي',
      scanWorkspaceTitle: 'منطقة المسح الضوئي والمعالجة',
      hardwareScanPlaceholder: 'امسح الباركود أو ادخل الرقم المرجعي للتعرف السريع...',
      cameraScan: 'مسح بالكاميرا',
      manualEntry: 'إدخال يدوي',
      inboundReceiving: 'الاستلام السريع بالمستودع',
      sortingQueue: 'طابور التجميع والفرز',
      manifestsWorkspace: 'المنفيستات وبيانات الشحن',
      dispatchRelease: 'الإخراج وتسليم الكابتن',
      exceptionsQueue: 'استثناءات وطوارئ المستودع',
      scanToIdentify: 'مسح للتعرف على الطرد',
      readyToScan: 'المستودع جاهز لمسح الباركود',
      readyToScanDesc: 'استخدم القارئ الضوئي أو الكاميرا لبدء نقل العهدة أو إعداد المنفيست',
      identifiedParcel: 'بيانات الطرد المحدد',
      allowedActions: 'الإجراءات المتاحة تشغيلياً',
      confirmAction: 'تأكيد نقل العهدة / الإجراء',
      recentActivity: 'آخر السجلات التشغيلية الموثقة',
      incomingPackages: 'شحنات بانتظار الاستلام',
      custodyPackages: 'شحنات داخل عهدة المستودع',
      readyDispatch: 'جاهز للتسليم للكابتن',
      activeManifests: 'منفيستات نشطة',
      sealManifest: 'تشميع وإغلاق المنفيست',
      sealNumber: 'رقم الختم / التشميع',
      printManifest: 'طباعة كشف المنفيست',
      createManifest: 'إنشاء منفيست جديد',
      manifestType: 'نوع المنفيست',
      destinationFacility: 'المستودع الوجهة',
      assignedDriver: 'الكابتن المكلف',
      notes: 'ملاحظات تشغيلية',
      duplicateScanWarning: 'جاري المعالجة... يرجى عدم تكرار المسح',
      noAllowedActions: 'لا تتوفر إجراءات معالجة تشغيلية مسموحة لهذا الطرد في المستودع الحالي',
      from: 'من',
      to: 'إلى',
      title: 'إدارة المستودع وعمليات الفرز والمنفيستات',
      subtitle: 'الاستلام السريع، الفرز الجغرافي، التجميع وإخراج الشحنات للكبائن مع التحقق الضوئي',
      currentFacility: 'المستودع الحالي:',
      refresh: 'تحديث بيانات الطوابير',
      scanAnythingBtn: 'ماسح Scan Anything',
      tabInbound: 'الاستلام السريع (Inbound)',
      parcelsCount: 'طرد',
      tabSorting: 'الفرز والتجميع (Sorting)',
      tabManifests: 'المنفيستات (Manifests)',
      tabDispatch: 'الإخراج للتسليم (Dispatch)',
      readyCount: 'جاهزة',
      tabExceptions: 'الاستثناءات (Exceptions)',
      fastIntakeTitle: 'مسح الاستلام السريع للمستودع',
      fastIntakeSub: 'ادخل أو امسح باركود الشحنة لتسجيل دخولها لعهدة المستودع وإصدار إشعار استلام',
      scanInputPlaceholder: 'امسح الباركود أو ادخل الرقم المرجعي (مثال: ORD-2026-1001)...',
      confirmIntakeBtn: 'تأكيد الاستلام',
      expectedQueueTitle: 'طابور الشحنات المتوقع وصولها للمستودع',
      expectedQueueSub: 'الشحنات القادمة من استلامات التجار أو النقل بين المستودعات',
      expectedCount: 'شحنة متوقعة',
      colTracking: 'رقم الشحنة / التتبع',
      colSender: 'المرسل / المتجر',
      colRecipient: 'المستلم / العنوان',
      colRouteType: 'نوع المسار',
      colLegStatus: 'حالة المسار',
      colAction: 'إجراء سريع',
      noInbound: 'لا توجد شحنات قادمة بانتظار الاستلام حالياً',
      sortingTitle: 'منطقة الفرز والتجميع الميداني حسب المدن والمناطق',
      sortingSub: 'يتم تجميع الطرود المستلمة وتوزيعها تلقائياً حسب المحافظة والمنطقة لتسهيل إعداد كشوفات الانطلاق.',
      noSorting: 'لا توجد شحنات داخل المستودع بانتظار الفرز والتجميع حالياً',
      manifestsTitle: 'منفيستات وكشوفات نقل وتوزيع الشحنات',
      manifestsSub: 'إنشاء كشوفات الانطلاق للكبائن (Runsheet) أو كشوفات النقل بين المستودعات (Hub Transfer)',
      createNewManifestBtn: 'إنشاء منفيست جديد',
      manifestListTitle: 'سجل المنفيستات',
      noManifests: 'لا توجد منفيستات مسجلة حالياً',
      selectManifestPrompt: 'اختر منفيست من القائمة لعرض تفاصيله وبدء إضافة الشحنات أو التشميع',
      printManifestBtn: 'طباعة المنفيست',
      sealManifestBtn: 'تشميع وإغلاق',
      scanToAddPlaceholder: 'امسح باركود الشحنة لإضافتها للمنفيست...',
      addBtn: 'إضافة',
      noManifestItems: 'لا توجد شحنات مضافة لهذا المنفيست بعد',
      dispatchTitle: 'إخراج وتثبيت العهدة للكبائن (Driver Dispatch)',
      dispatchSub: 'اختر الكابتن وامسح باركود الشحنة لنقل عهدتها وتسليمها الميداني فوراً',
      targetDriverLabel: 'اختر الكابتن المستلم:',
      selectDriverOption: '-- اختر الكابتن --',
      scanDispatchPlaceholder: 'امسح باركود الشحنة للإخراج...',
      confirmReleaseBtn: 'تأكيد الإخراج',
      readyDispatchTitle: 'الشحنات الجاهزة للإخراج والتسليم',
      noReadyDispatch: 'لا توجد شحنات جاهزة للإخراج حالياً',
      handoverBtn: 'تسليم للكابتن',
      exceptionsTitle: 'جدول الاستثناءات والشحنات المعلقة بالمستودع',
      exceptionsSub: 'الشحنات التي واجهت مشاكل أثناء التسليم أو تتطلب إعادة توجيه / مرتجع للتاجر.',
      colRecommendedAction: 'الإجراء الموصى به',
      noExceptions: 'لا توجد شحنات مستثناة أو معلقة بالمستودع حالياً',
      createManifestModalTitle: 'إنشاء منفيست شحن جديد',
      manifestTypeLabel: 'نوع المنفيست:',
      driverRunsheetOpt: 'كشف انطلاق كابتن (DRIVER RUNSHEET)',
      hubTransferOpt: 'نقل بين مستودعين (HUB TRANSFER)',
      destFacilityLabel: 'المستودع الوجهة:',
      selectFacilityOption: '-- اختر المستودع الوجهة --',
      notesLabel: 'ملاحظات تشغيلية:',
      createBtn: 'إنشاء المنفيست',
      cancelBtn: 'إلغاء',
      sealModalTitle: 'تشميع وإغلاق المنفيست',
      sealModalSub: 'بعد التشميع، لن تتمكن من إضافة أو حذف أي شحنات من المنفيست. وسيتم اعتماد حالة الجاهزية للنقل.',
      sealNumberLabel: 'رقم الختم الأمني (Seal #):',
      confirmSealBtn: 'تأكيد التشميع والإغلاق',
      printModalTitle: 'معاينة كشف المنفيست للطباعة',
      printNowBtn: 'طباعة الآن',
      delivereLogisticsERP: 'نظام ديليفري اللوجستي - Delivere ERP',
      signatureFacility: 'توقيع وختم المستودع:',
      signatureDriver: 'توقيع الكابتن المستلم:',
    },
    auth: {
      welcomeBack: 'مرحباً بعودتك',
      signInToManage: 'سجّل الدخول لإدارة عملياتك اللوجستية',
      signInTitle: 'تسجيل الدخول',
      signInSubtitle: '',
      identifierLabel: 'البريد الإلكتروني أو رقم الهاتف',
      identifierPlaceholder: 'name@company.com',
      passwordLabel: 'كلمة المرور',
      passwordPlaceholder: '••••••••',
      showPassword: 'إظهار كلمة المرور',
      hidePassword: 'إخفاء كلمة المرور',
      rememberMe: 'تذكر جلستي على هذا الجهاز',
      signInButton: 'تسجيل الدخول',
      signingIn: 'جاري تسجيل الدخول...',
      reconnecting: 'جاري الاتصال...',
      googleButton: 'المتابعة عبر Google',
      orDivider: 'أو',
      redeemInvitePrompt: 'لديك دعوة انضمام؟',
      redeemInviteInputPlaceholder: 'رمز الدعوة أو رابط التفعيل',
      activateButton: 'تفعيل',
      cancelButton: 'إلغاء',
      microCopy: '',
      secureConnection: '',
      retry: 'إعادة المحاولة',
    },
  },
  en: {
    common: {
      appName: 'Delivere',
      searchPlaceholder: 'Quick search by Ref #, Phone, Customer, Tracking... (Ctrl+K)',
      scan: 'Scan Barcode',
      newOrder: 'New Order',
      quickOrder: 'Quick Order',
      save: 'Save',
      cancel: 'Cancel',
      close: 'Close',
      refresh: 'Refresh',
      actions: 'Actions',
      status: 'Status',
      filter: 'Filter',
      clear: 'Clear',
      export: 'Export',
      print: 'Print',
      loading: 'Loading...',
      noData: 'No data available',
      viewAll: 'View All',
      details: 'Details',
      edit: 'Edit',
      delete: 'Delete',
      confirm: 'Confirm',
      back: 'Back',
      language: 'Language / اللغة',
      logout: 'Logout',
      profile: 'Profile',
      allBranches: 'All Branches',
      allMerchants: 'All Merchants',
      allDrivers: 'All Drivers',
    },
    navigation: {
      controlTower: 'Logistics Control Tower',
      orders: 'Shipments & Orders',
      dispatch: 'Dispatch & Routing',
      liveMap: 'Live Operations Map',
      drivers: 'Driver & Fleet Ops',
      branches: 'Branches & Hubs',
      manifests: 'Manifests & Sheets',
      returns: 'Reverse Logistics & Returns',
      finance: 'COD & Settlements',
      merchants: 'Merchant OS',
      reports: 'Reports & Analytics',
      pricing: 'Price Plans',
      teamPermissions: 'Team & Permissions',
      automations: 'Automation Engine',
      settings: 'System Settings',
      pos: 'Point of Sale (POS)',
      inventory: 'Inventory & WMS',
    },
    controlTower: {
      title: 'Logistics Control Tower',
      subtitle: 'Real-time operational monitoring, critical exceptions, fleet status, and financial flows',
      needsAttention: 'Needs Immediate Attention',
      waitingPickup: 'Waiting Pickup',
      atHub: 'At Sorting Hub',
      readyForDispatch: 'Ready for Dispatch',
      outForDelivery: 'Out for Delivery',
      failedAttempts: 'Failed Attempts',
      postponed: 'Postponed',
      returnsWaiting: 'Pending Returns',
      unassigned: 'Unassigned',
      lateOrders: 'Late Orders',
      codIssues: 'COD Discrepancies',
      activeFleet: 'Fleet Activity',
      cashInCustody: 'Driver Cash Custody',
      merchantPayables: 'Pending Merchant Payables',
      recentActivity: 'Live Operational Feed',
      operationalQueues: 'Operational Queues',
      quickMetrics: 'Quick Operational Metrics',
      fleetStatus: 'Field Fleet Status',
      activeDrivers: 'Active Online Drivers',
      offlineDrivers: 'Offline Drivers',
    },
    orders: {
      title: 'Shipments Data Grid',
      createTitle: 'Create New Order',
      quickCreateTitle: 'Quick Order Entry',
      customerTotalToCollect: 'Amount to Collect from Customer',
      customerTotalHelper: 'Delivery fee included in this total',
      deliveryFeeIncluded: 'Delivery fee is included in the customer total',
      customerName: 'Customer Full Name',
      customerPhone: 'Customer Phone Number',
      secondaryPhone: 'Secondary Phone',
      governorate: 'Governorate',
      area: 'Area / Neighborhood',
      address: 'Detailed Address',
      parcelType: 'Parcel Content / Type',
      declaredValue: 'Declared Parcel Value',
      notes: 'Shipment Notes & Special Instructions',
      merchantCollectionPreview: 'Expected Net Merchant Collection:',
      calculatedDeliveryFee: 'Calculated Delivery Fee:',
      netMerchantCollection: 'Net Merchant Collection:',
      trackingNumber: 'Tracking Number (Babel Code)',
      referenceNumber: 'Merchant Ref #',
      merchant: 'Merchant',
      driver: 'Assigned Driver',
      branch: 'Assigned Branch',
      drawerTabs: {
        overview: 'Overview',
        journey: 'Journey',
        timeline: 'Timeline',
        customer: 'Customer',
        shipment: 'Shipment',
        finance: 'Finance',
        pod: 'POD',
        returns: 'Returns',
        tasks: 'Tasks & Alerts',
        audit: 'Audit Log',
      },
      journey: {
        title: 'Operational Shipment Journey (Visual)',
        origin: 'Origin (Merchant)',
        destination: 'Destination (Recipient)',
        currentCustody: 'Current Operational Stage & Assignment',
        firstMile: 'Stage 1: Pickup / First Mile',
        sortingHub: 'Stage 2: Hub Operations / Transit',
        lastMile: 'Stage 3: Last Mile Delivery',
        responsibleParty: 'Assigned Operational Party',
        completedLeg: 'Completed',
        inProgressLeg: 'In Progress',
        pendingLeg: 'Pending',
        unverifiedCustodyNotice: 'Operational stage inferred from status (does not constitute verified physical custody)',
        visualJourneyNotice: 'Visual journey derived from single-driver order status - no multi-leg records',
        assignedDriver: 'Assigned Driver',
        unassignedDriver: 'No driver assigned yet',
        mainHubName: 'Main Transit & Sorting Hub (Amman Hub)',
        outForDeliveryLeg: 'Out for Field Delivery',
        reverseLeg: 'Reverse Delivery to Merchant',
        expectedNextLocation: 'Expected Operational Location',
      },
      timeline: {
        title: 'Timeline & Event Audit Log',
        verifiedEventAudit: 'Recorded Event Audit',
        recordedEvents: 'Recorded Events',
        noEvents: 'This shipment has no historical events logged yet.',
        otpVerified: 'OTP Verified',
        signed: 'Signature Verified',
        assignedDriverLabel: 'Assigned Driver',
      },
      opsActions: {
        changeStatus: 'Change Status',
        assignDriver: 'Assign Driver',
        printWaybill: 'Print Waybill',
        callCustomer: 'Call Customer',
        callMerchant: 'Call Merchant',
        whatsappCustomer: 'WhatsApp Customer',
        whatsappMerchant: 'WhatsApp Merchant',
        sendOtpSms: 'Send OTP SMS',
        cliqPayment: 'CliQ Payment',
        openMap: 'Open Map',
        copyPhone: 'Copy Phone',
      },
    },
    driver: {
      collectFromCustomer: 'Amount to Collect from Customer',
      collectFromCustomerHelper: 'Please collect this full amount including delivery fee',
      myEarning: 'My Earning',
      cashCustody: 'My Cash Custody',
      activeTasks: 'Active Tasks & Orders',
      onlineStatus: 'Field Duty Status',
      goOnline: 'Start Shift / Go Online',
      goOffline: 'End Shift / Go Offline',
      title: 'Field Delivery Captain',
      subtitle: 'Delivere Mobile Captain',
      vehicle: 'Vehicle',
      plate: 'Plate',
      cashInHand: 'Cash Held in Hand',
      refreshWorkload: 'Refresh Workload',
      inVehicleCustody: 'In Vehicle Custody',
      awaitingDepotRelease: 'Awaiting Depot Release',
      deliveredToday: 'Delivered Today',
      totalCodRemaining: 'COD Remaining',
      tabActiveStops: 'Active Stops',
      tabMyLoad: 'My Load & Custody',
      tabCompleted: 'Completed',
      tabExceptions: 'Exceptions',
      tabCashLedger: 'Cash Ledger',
      priorityStopHeader: 'Current Priority Assignment',
      recipient: 'Recipient',
      governorateArea: 'Area',
      requiredCollection: 'Collection Required',
      prepaid: 'Prepaid',
      call: 'Call',
      whatsapp: 'WhatsApp',
      navigate: 'Navigate',
      recordFailure: 'Record Failure',
      confirmDelivery: 'Confirm Delivery',
      confirmDeliveryFinal: 'Confirm Final Delivery',
      paymentMethod: 'Payment Method',
      cashCod: 'Cash (COD)',
      cliqTransfer: 'Instant CliQ Transfer',
      cliqRefPlaceholder: 'CliQ Bank Reference *',
      deliveryOtp: 'Delivery OTP Code',
      recipientSignature: 'Recipient Signature (POD)',
      clearSignature: 'Clear Signature',
      deliveryNotes: 'Delivery Notes',
      failureReason: 'Failure Reason *',
      failureNotes: 'Additional Details & Notes',
      confirmFailure: 'Confirm Delivery Failure',
      noActiveStops: 'No active stops currently',
      noActiveStopsSub: 'All assigned tasks delivered or no parcels in vehicle.',
      noCashRecords: 'No cash collection records logged.',
    },
    finance: {
      merchantCollection: 'Net Merchant Collection',
      deliveryFee: 'Delivery Fee',
      driverEarning: 'Driver Earning',
      companyRevenue: 'Company Revenue',
      netPayable: 'Net Payable for Settlement',
      settlements: 'Settlements & Statements',
      driverRemittance: 'Driver Cash Reconciliation & Closeout',
    },
    hub: {
      workspaceTitle: 'Hub & Sorting Operations Workspace',
      facilityContext: 'Current Facility Context',
      facilitySelect: 'Operating Facility / Hub',
      scanWorkspaceTitle: 'Scan & Processing Workspace',
      hardwareScanPlaceholder: 'Scan barcode or enter tracking/ref for quick lookup...',
      cameraScan: 'Camera Scanner',
      manualEntry: 'Manual Entry',
      inboundReceiving: 'Fast Inbound Receiving',
      sortingQueue: 'Sorting & Aggregation Queue',
      manifestsWorkspace: 'Manifests & Shipping Runsheets',
      dispatchRelease: 'Dispatch & Driver Release',
      exceptionsQueue: 'Hub Operational Exceptions',
      scanToIdentify: 'Scan to Identify Parcel',
      readyToScan: 'Hub is Ready for Barcode Scan',
      readyToScanDesc: 'Use barcode reader or camera to start custody transfer or manifest processing',
      identifiedParcel: 'Identified Parcel Details',
      allowedActions: 'Server-Allowed Operational Actions',
      confirmAction: 'Confirm Action & Custody Transfer',
      recentActivity: 'Recent Authoritative Hub Activity',
      incomingPackages: 'Incoming Packages',
      custodyPackages: 'Packages in Hub Custody',
      readyDispatch: 'Ready for Driver Dispatch',
      activeManifests: 'Active Manifests',
      sealManifest: 'Seal & Close Manifest',
      sealNumber: 'Seal / Lock Number',
      printManifest: 'Print Manifest Sheet',
      createManifest: 'Create New Manifest',
      manifestType: 'Manifest Type',
      destinationFacility: 'Destination Facility',
      assignedDriver: 'Assigned Driver',
      notes: 'Operational Notes',
      duplicateScanWarning: 'Processing... Avoid duplicate scan',
      noAllowedActions: 'No operational actions available for this parcel at the current facility',
      from: 'From',
      to: 'To',
      title: 'Hub Management, Sorting & Manifest Operations',
      subtitle: 'Fast Receiving, Geographic Sorting, Staging & Driver Dispatch with Barcode Verification',
      currentFacility: 'Current Hub:',
      refresh: 'Refresh Queue Data',
      scanAnythingBtn: 'Scan Anything Scanner',
      tabInbound: 'Fast Inbound Receiving',
      parcelsCount: 'parcels',
      tabSorting: 'Sorting & Staging',
      tabManifests: 'Manifests Workspace',
      tabDispatch: 'Driver Dispatch',
      readyCount: 'ready',
      tabExceptions: 'Hub Exceptions',
      fastIntakeTitle: 'Fast Inbound Intake Scanner',
      fastIntakeSub: 'Scan or enter parcel barcode to confirm custody intake at current facility',
      scanInputPlaceholder: 'Scan barcode or enter tracking number (e.g., ORD-2026-1001)...',
      confirmIntakeBtn: 'Confirm Intake',
      expectedQueueTitle: 'Expected Incoming Parcels Queue',
      expectedQueueSub: 'Parcels arriving from merchant pickups or inter-hub transfers',
      expectedCount: 'expected',
      colTracking: 'Tracking / Barcode',
      colSender: 'Sender / Merchant',
      colRecipient: 'Recipient / City',
      colRouteType: 'Leg Type',
      colLegStatus: 'Leg Status',
      colAction: 'Quick Action',
      noInbound: 'No incoming parcels awaiting intake at this facility',
      sortingTitle: 'Geographic Sorting & Regional Staging Area',
      sortingSub: 'Received parcels are grouped by destination city for runsheet assembly',
      noSorting: 'No parcels currently in hub custody awaiting sorting',
      manifestsTitle: 'Manifests & Shipping Runsheets Workspace',
      manifestsSub: 'Create driver runsheets or inter-hub transfer manifests',
      createNewManifestBtn: 'Create New Manifest',
      manifestListTitle: 'Manifest Registry',
      noManifests: 'No manifests registered for this hub',
      selectManifestPrompt: 'Select a manifest from the list to view items or seal',
      printManifestBtn: 'Print Manifest',
      sealManifestBtn: 'Seal & Lock',
      scanToAddPlaceholder: 'Scan parcel barcode to add to manifest...',
      addBtn: 'Add Item',
      noManifestItems: 'No parcels added to this manifest yet',
      dispatchTitle: 'Driver Dispatch & Handover',
      dispatchSub: 'Select driver and scan parcel barcode to assign custody for field delivery',
      targetDriverLabel: 'Target Assigned Driver:',
      selectDriverOption: '-- Select Driver --',
      scanDispatchPlaceholder: 'Scan parcel barcode to release...',
      confirmReleaseBtn: 'Confirm Release',
      readyDispatchTitle: 'Parcels Ready for Driver Release',
      noReadyDispatch: 'No parcels ready for dispatch at this facility',
      handoverBtn: 'Handover to Driver',
      exceptionsTitle: 'Hub Exception & Hold Queue',
      exceptionsSub: 'Failed deliveries or return shipments requiring hub intervention',
      colRecommendedAction: 'Recommended Resolution',
      noExceptions: 'No exception parcels currently held at this facility',
      createManifestModalTitle: 'Create New Shipping Manifest',
      manifestTypeLabel: 'Manifest Type:',
      driverRunsheetOpt: 'DRIVER RUNSHEET',
      hubTransferOpt: 'HUB TRANSFER',
      destFacilityLabel: 'Destination Facility:',
      selectFacilityOption: '-- Select Destination Hub --',
      notesLabel: 'Operational Notes:',
      createBtn: 'Create Manifest',
      cancelBtn: 'Cancel',
      sealModalTitle: 'Seal & Lock Manifest',
      sealModalSub: 'Once sealed, no further parcels can be added or removed.',
      sealNumberLabel: 'Security Seal #:',
      confirmSealBtn: 'Confirm & Lock Seal',
      printModalTitle: 'Printable Shipping Manifest Preview',
      printNowBtn: 'Print Now',
      delivereLogisticsERP: 'Delivere Logistics System - ERP',
      signatureFacility: 'Facility Stamp & Signature:',
      signatureDriver: 'Receiving Driver Signature:',
    },
    auth: {
      welcomeBack: 'Welcome Back',
      signInToManage: 'Sign in to manage your logistics operations',
      signInTitle: 'Sign In',
      signInSubtitle: '',
      identifierLabel: 'Email or phone',
      identifierPlaceholder: 'name@company.com',
      passwordLabel: 'Password',
      passwordPlaceholder: '••••••••',
      showPassword: 'Show password',
      hidePassword: 'Hide password',
      rememberMe: 'Remember my session on this device',
      signInButton: 'Sign In',
      signingIn: 'Signing in...',
      reconnecting: 'Connecting...',
      googleButton: 'Continue with Google',
      orDivider: 'OR',
      redeemInvitePrompt: 'Have an invitation?',
      redeemInviteInputPlaceholder: 'Invite code or redemption link',
      activateButton: 'Activate',
      cancelButton: 'Cancel',
      microCopy: '',
      secureConnection: '',
      retry: 'Retry',
    },
  },
};

interface I18nContextType {
  language: Language;
  direction: Direction;
  t: Translations;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('delivere_lang');
      if (saved === 'ar' || saved === 'en') return saved;
    } catch {
      // ignore
    }
    return 'ar'; // Default Arabic-first
  });

  const direction: Direction = language === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    try {
      localStorage.setItem('delivere_lang', language);
    } catch {
      // ignore
    }
    document.documentElement.setAttribute('lang', language);
    document.documentElement.setAttribute('dir', direction);
  }, [language, direction]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const toggleLanguage = () => {
    setLanguageState((prev) => (prev === 'ar' ? 'en' : 'ar'));
  };

  const value: I18nContextType = {
    language,
    direction,
    t: translations[language],
    setLanguage,
    toggleLanguage,
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export function useI18n(): I18nContextType {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
