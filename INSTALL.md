# Batch 12 — تعليمات التثبيت

## الملفات المعدّلة (5 ملفات)

| الملف | النوع | الملاحظات |
|---|---|---|
| `src/index.css` | تعديل | إضافة 338 سطر في النهاية (لم يُلمس أي class قديم) |
| `src/App.jsx` | تعديل | استبدال شاشة `home` داخل `AdminDataEntry` فقط + إضافة import |
| `src/components/SalesFormV2.jsx` | إعادة بناء | تصميم 1:1 مع الـ prototype |
| `src/components/ExpenseFormV2.jsx` | إعادة بناء | تصميم 1:1 + ترتيب التصنيفات الأساسية أولاً |
| `src/components/RecHistorySection.jsx` | جديد | مكوّن مشترك لقائمة آخر 7 أيام |

## خطوات التثبيت

### 1. نسخة احتياطية (مهم!)
```powershell
cd C:\Users\ahmad\toia-wardana
git add -A
git commit -m "Pre Batch 12 backup"
```

### 2. استبدال الملفات
انسخ المجلد `src/` فوق الموجود في المشروع (سيستبدل 4 ملفات قديمة + يضيف ملف جديد).

### 3. تشغيل dev server
```powershell
npm run dev
```

### 4. الاختبار اليدوي
**شاشة المدير — المبيعات والمصروفات:**
1. ادخل كمدير
2. الإعدادات → "المبيعات والمصروفات"
3. اختر فرع (تويا أو وردانة)
4. ✅ يجب أن تشاهد: شريط علوي "وضع المدير — فرع X | تغيير الفرع" + شريط عنوان + زرّان (تسجيل المبيعات، تسجيل المصروفات) + قائمة "آخر 7 أيام" تحتها

**شاشة تسجيل المبيعات:**
1. اضغط "تسجيل المبيعات"
2. ✅ يجب: pills للتاريخ والفرع + كارت أبيض فيه 3 صفوف (كاش/مدى/تحويل) + شريط Total Navy gradient + زرّين (إلغاء/حفظ)
3. أدخل قيمة في "مدى" — يظهر كارت رسوم مدى الأصفر

**شاشة تسجيل المصروفات:**
1. اضغط "تسجيل المصروفات"
2. ✅ يجب: chips للتصنيفات (الأساسية الأربعة بلون cyan tint، الباقي أبيض)
3. اختر "ورد" — زر الصورة يصبح أحمر بـ "اضغط لالتقاط الصورة بالكاميرا" + تنبيه أحمر
4. اختر "كهرباء" — زر الصورة يعود طبيعياً، يفتح gallery + camera

## التغييرات في `index.css` (الإضافات فقط)

تمت إضافة هذه الـ classes الجديدة (لم يُلمس أي class قديم):

```
.tw-payment-row, .tw-total-strip, .tw-form-card,
.tw-chips, .tw-chip, .tw-chip.primary,
.tw-photo-up, .tw-photo-note, .tw-photo-preview-wrap, .tw-photo-remove,
.tw-rec-history-section, .tw-rec-history-title, .tw-rec-card,
.tw-rec-icon (.sale/.expense), .tw-rec-body, .tw-rec-amt,
.tw-rec-day-header, .tw-rec-empty,
.tw-page-bg, .tw-controls-row
```

## المنطق المحفوظ بالكامل (لم يُلمس)

✅ `firebase.js` — لم يُلمس
✅ `addDailySales`, `addExpense`, `uploadInvoiceImage`
✅ `MADA_FEE_RATE`, `madaFees`, `madaNet`
✅ `getCategories`, `getPaymentMethods`, `getSales`, `getExpenses`
✅ كاميرا إجبارية للتصنيفات التي `requiresImage = true`
✅ بنية i18n.js — لم تُلمس
✅ شاشة الموظف `EmployeeHome` — لم تُلمس
✅ كل شاشات المدير الأخرى — لم تُلمس
✅ `SarSymbol` — لم يُلمس (موجود مسبقاً بتصميم SAMA الصحيح)
✅ `EmployeeHistory` — لم يُلمس (يستخدم تصميمه القديم)
   ملاحظة: تستطيع لاحقاً تحويله لاستخدام `RecHistorySection` المشترك

## إذا واجهت مشكلة

- **لا تظهر التصميمات الجديدة**: امسح cache `npm run dev -- --force` أو `Ctrl+Shift+R` في المتصفح
- **خطأ في import**: تأكد أن `src/components/RecHistorySection.jsx` موجود
- **الشاشة فارغة**: افتح Console (F12) — لو فيه خطأ في `getSales`/`getExpenses`، تحقق من Firestore rules
- **الرجوع للسابق**: `git reset --hard HEAD~1`

## Commit message مقترح

```
Batch 12: Sales + Expense forms + RecordOps screen — prototype 1:1

- Rebuild SalesFormV2 with .tw-payment-row, .tw-total-strip, .tw-form-card
- Rebuild ExpenseFormV2 with .tw-chips (primary cyan tint for 4 main categories)
- New RecHistorySection shared component for last-7-days list
- AdminDataEntry manager mode: 2-button layout + 7-day history below
- index.css: +338 lines of prototype-mirror classes (no existing classes touched)

Preserved: firebase.js, MADA_FEE_RATE logic, i18n structure,
camera-only flow for required categories, EmployeeHome screen.
```
