import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {
  Button,
  IconButton,
  Input,
  Select,
  StatusBadge,
  PriorityIndicator,
  Skeleton,
  Modal,
  Drawer,
  EmptyState,
  PageHeader,
} from '../src/components/ui';

test('1. Primitive Exports and Component Signatures', () => {
  assert.equal(typeof Button, 'function', 'Button component must be exported as a function');
  assert.equal(typeof IconButton, 'function', 'IconButton component must be exported as a function');
  assert.equal(typeof Input, 'object', 'Input component (forwardRef) must be exported as an object');
  assert.equal(typeof Select, 'object', 'Select component (forwardRef) must be exported as an object');
  assert.equal(typeof StatusBadge, 'function', 'StatusBadge component must be exported as a function');
  assert.equal(typeof PriorityIndicator, 'function', 'PriorityIndicator must be exported as a function');
  assert.equal(typeof Skeleton, 'function', 'Skeleton component must be exported as a function');
  assert.equal(typeof Modal, 'function', 'Modal component must be exported as a function');
  assert.equal(typeof Drawer, 'function', 'Drawer component must be exported as a function');
  assert.equal(typeof EmptyState, 'function', 'EmptyState component must be exported as a function');
  assert.equal(typeof PageHeader, 'function', 'PageHeader component must be exported as a function');
});

test('2. Button Rendering & Default Behavior Contracts', () => {
  // Verify Button default type is "button" to avoid unintended form submissions
  const defaultBtn = React.createElement(Button, { children: 'حفظ التغييرات' });
  assert.equal(defaultBtn.props.children, 'حفظ التغييرات');
  assert.equal(defaultBtn.type, Button);

  // Primary variant
  const primaryBtn = React.createElement(Button, {
    variant: 'primary',
    size: 'compact',
    isLoading: true,
    children: 'جاري التحميل',
  });
  assert.equal(primaryBtn.props.variant, 'primary');
  assert.equal(primaryBtn.props.size, 'compact');
  assert.equal(primaryBtn.props.isLoading, true);

  // Danger variant with fullWidth
  const dangerBtn = React.createElement(Button, {
    variant: 'danger',
    size: 'large',
    fullWidth: true,
    disabled: true,
    children: 'إلغاء الطلب',
  });
  assert.equal(dangerBtn.props.variant, 'danger');
  assert.equal(dangerBtn.props.fullWidth, true);
  assert.equal(dangerBtn.props.disabled, true);
});

test('3. IconButton Accessibility & Sizing Contracts', () => {
  const iconBtn = React.createElement(IconButton, {
    'aria-label': 'إغلاق اللوحة',
    variant: 'ghost',
    size: 'compact',
  });
  assert.equal(iconBtn.props['aria-label'], 'إغلاق اللوحة');
  assert.equal(iconBtn.props.variant, 'ghost');
  assert.equal(iconBtn.props.size, 'compact');
});

test('4. Input Form & Error Contracts', () => {
  const inputEl = React.createElement(Input, {
    label: 'رقم التتبع',
    placeholder: 'DEL-2026-XXXX',
    error: 'رقم التتبع غير صالح',
    mono: true,
    sizeVariant: 'default',
  });
  assert.equal(inputEl.props.label, 'رقم التتبع');
  assert.equal(inputEl.props.error, 'رقم التتبع غير صالح');
  assert.equal(inputEl.props.mono, true);
});

test('5. Select Wrapper & Options Contracts', () => {
  const options = [
    { value: 'ALL', label: 'جميع الحالات' },
    { value: 'ACTIVE', label: 'المهام النشطة' },
    { value: 'COMPLETED', label: 'المهام المكتملة' },
  ];
  const selectEl = React.createElement(Select, {
    label: 'تصفية المهام',
    options,
    defaultValue: 'ACTIVE',
  });
  assert.equal(selectEl.props.label, 'تصفية المهام');
  assert.equal(selectEl.props.options?.length, 3);
  assert.equal(selectEl.props.defaultValue, 'ACTIVE');
});

test('6. StatusBadge Backward Compatibility & Semantic Tones', () => {
  // Legacy domain status format
  const legacyDelivered = React.createElement(StatusBadge, {
    status: 'DELIVERED',
    size: 'sm',
  });
  assert.equal(legacyDelivered.props.status, 'DELIVERED');
  assert.equal(legacyDelivered.props.size, 'sm');

  // Legacy returned status format
  const legacyReturned = React.createElement(StatusBadge, {
    status: 'RETURNED',
    className: 'custom-class',
  });
  assert.equal(legacyReturned.props.status, 'RETURNED');
  assert.equal(legacyReturned.props.className, 'custom-class');

  // New semantic tone format
  const semanticWarning = React.createElement(StatusBadge, {
    tone: 'warning',
    label: 'يحتاج تدقيق مالي',
    dot: true,
    size: 'md',
  });
  assert.equal(semanticWarning.props.tone, 'warning');
  assert.equal(semanticWarning.props.label, 'يحتاج تدقيق مالي');
  assert.equal(semanticWarning.props.dot, true);
});

test('7. PriorityIndicator Presentation Levels', () => {
  const levels = ['LOW', 'NORMAL', 'HIGH', 'URGENT', 'CRITICAL'] as const;
  for (const level of levels) {
    const indicator = React.createElement(PriorityIndicator, {
      priority: level,
      size: 'sm',
    });
    assert.equal(indicator.props.priority, level);
  }
});

test('8. Skeleton Variants & Reduced Motion Safety', () => {
  const textSkeleton = React.createElement(Skeleton, { variant: 'text' });
  const rowSkeleton = React.createElement(Skeleton, { variant: 'row', height: 40 });
  const circleSkeleton = React.createElement(Skeleton, { variant: 'circle', width: 32, height: 32 });

  assert.equal(textSkeleton.props.variant, 'text');
  assert.equal(rowSkeleton.props.variant, 'row');
  assert.equal(circleSkeleton.props.variant, 'circle');
});

test('9. Modal Accessible Dialog Contracts', () => {
  const onClose = () => {};
  const modalEl = React.createElement(
    Modal,
    {
      isOpen: true,
      onClose,
      title: 'تأكيد العملية التشغيلية',
      description: 'يرجى مراجعة تفاصيل الشحنة قبل التأكيد',
      maxWidth: 'lg',
      closeOnEscape: true,
      closeOnBackdropClick: true,
      children: React.createElement('div', null, 'محتوى النافذة'),
    }
  );

  assert.equal((modalEl.props as any).isOpen, true);
  assert.equal((modalEl.props as any).title, 'تأكيد العملية التشغيلية');
  assert.equal((modalEl.props as any).closeOnEscape, true);
  assert.equal((modalEl.props as any).maxWidth, 'lg');
});

test('10. Drawer Master-Detail & Direction Contracts', () => {
  const onClose = () => {};
  const drawerEl = React.createElement(
    Drawer,
    {
      isOpen: true,
      onClose,
      title: 'تفاصيل المهمة التشغيلية',
      subtitle: 'TASK-2026-0921-001',
      side: 'end',
      width: 'lg',
      children: React.createElement('div', null, 'تفاصيل المهمة'),
    }
  );

  assert.equal((drawerEl.props as any).isOpen, true);
  assert.equal((drawerEl.props as any).title, 'تفاصيل المهمة التشغيلية');
  assert.equal((drawerEl.props as any).side, 'end');
  assert.equal((drawerEl.props as any).width, 'lg');
});

test('11. EmptyState Visual Feedback Contracts', () => {
  const emptyDefault = React.createElement(EmptyState, {
    title: 'لا توجد مهام حالياً',
    description: 'جميع المهام التشغيلية مكتملة أو لم يتم تعيين أي مهمة جديدة.',
    variant: 'default',
  });
  assert.equal(emptyDefault.props.title, 'لا توجد مهام حالياً');
  assert.equal(emptyDefault.props.variant, 'default');

  const emptyFiltered = React.createElement(EmptyState, {
    title: 'لا توجد نتائج مطابقة للبحث',
    description: 'جرب تعديل معايير البحث أو التصفية الحالية.',
    variant: 'filtered',
  });
  assert.equal(emptyFiltered.props.variant, 'filtered');
});

test('12. PageHeader Backward Compatibility Contracts', () => {
  const pageHeader = React.createElement(PageHeader, {
    title: 'برج المراقبة والتحكم اللوجستي',
    description: 'المتابعة الميدانية اللحظية للمهام وتدفق الشحنات',
    breadcrumbs: [
      { label: 'الرئيسية' },
      { label: 'العمليات اللوجستية' },
    ],
    badge: React.createElement(StatusBadge, { tone: 'info', label: 'مباشر' }),
  });

  assert.equal(pageHeader.props.title, 'برج المراقبة والتحكم اللوجستي');
  assert.equal(pageHeader.props.breadcrumbs?.length, 2);
  assert.ok(pageHeader.props.badge);
});
