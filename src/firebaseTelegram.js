// src/firebaseTelegram.js
// ====================================================================
// إشعارات Telegram (§S1) — مُستخرج من firebase.js (نقل فقط).
//
// يرسل إشعارات لقناة Telegram عند تسجيل مبيعات/مصاريف/عملاء واتساب (للموظفين فقط).
// التهيئة عبر Vercel env: VITE_TELEGRAM_BOT_TOKEN / VITE_TELEGRAM_CHAT_ID.
// لو القيم غير موجودة، الدوال تتجاهل بصمت. الإشعار fire-and-forget.
//
// التبعيات (استخدام وقت-تشغيل داخل الأجسام فقط ⇒ لا مشكلة دورة وقت التحميل):
//   - db / auth / getSales من firebase.js (getSales يبقى ضمن مجال المبيعات)
//   - getMonthlyGoal من firebaseGoals.js (مصدره الحقيقي)
// لا يُنقل أي منطق مبيعات/أهداف هنا — فقط استدعاؤها.
// ====================================================================
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "./firebaseCore";
import { getSales } from "./firebaseSales";
import { getMonthlyGoal } from "./firebaseGoals";

const TELEGRAM_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = import.meta.env.VITE_TELEGRAM_CHAT_ID;

/**
 * يرسل رسالة لقناة Telegram. fire-and-forget.
 * في حالة الفشل: console.warn فقط، لا يكسر الـ flow.
 */
async function sendTelegram(message) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
    // التهيئة غير مفعّلة — تجاهل بصمت
    return;
  }
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.warn('Telegram send failed:', errText);
    }
  } catch (err) {
    console.warn('Telegram error:', err?.message || err);
  }
}

/**
 * Batch 40: cache يحفظ اسم المستخدم + دوره.
 * يقلل قراءات Firestore المتكررة عند كل إشعار.
 */
let _userCache = null; // { name, role }

async function getCurrentUserInfo() {
  if (_userCache) return _userCache;
  const uid = auth.currentUser?.uid;
  if (!uid) return { name: 'غير معروف', role: null };
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      const data = snap.data();
      _userCache = {
        name: data.displayName || data.username || 'مستخدم',
        role: data.role || null, // 'admin' | 'employee'
      };
      return _userCache;
    }
  } catch {
    /* ignore */
  }
  return { name: 'مستخدم', role: null };
}

// Helper قديم للتوافق
async function getCurrentUserName() {
  const info = await getCurrentUserInfo();
  return info.name;
}

// Batch 40: فحص هل المستخدم الحالي موظف (لفلترة الإشعارات)
async function isCurrentUserEmployee() {
  const info = await getCurrentUserInfo();
  return info.role === 'employee';
}

// نمسح الـ cache عند تسجيل الخروج
export function clearUserNameCache() {
  _userCache = null;
}

/**
 * يرجع اسم الفرع بالعربي مع emoji.
 */
function branchLabel(branchId) {
  if (branchId === 'toia') return '🌸 تويا';
  if (branchId === 'wardana') return '🌹 وردانة';
  return `📍 ${branchId}`;
}

/**
 * يرجع نص طريقة الدفع.
 */
function payMethodLabel(id) {
  if (!id) return '—';
  const map = {
    'Cash': 'كاش 💵',
    'cash': 'كاش 💵',
    'Mada': 'مدى 💳',
    'mada': 'مدى 💳',
    'Transfer': 'تحويل 📱',
    'transfer': 'تحويل 📱',
    'Apple Pay': 'Apple Pay 🍎',
    'STC Pay': 'STC Pay 📱',
  };
  return map[id] || id;
}

/**
 * تنسيق رقم بفاصلة الآلاف.
 */
function fmt(num) {
  return Number(num || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/**
 * إشعار: مبيعات جديدة — يُرسل فقط لو المُسجِّل موظف
 */
export async function notifyTelegramSaleAdded({ date, branchId, cash, mada, transfer, total }) {
  // Batch 40: فلترة — للموظفين فقط (المدير لا يحتاج إشعار نفسه)
  const isEmp = await isCurrentUserEmployee();
  if (!isEmp) return;

  const user = await getCurrentUserName();
  const msg =
    `💵 <b>مبيعات جديدة</b>\n` +
    `${branchLabel(branchId)}\n` +
    `━━━━━━━━━━━━━━━\n` +
    `👤 المُسجِّل: ${user}\n` +
    `📅 التاريخ: ${date}\n\n` +
    `💵 كاش: <b>${fmt(cash)}</b> ﷼\n` +
    `💳 مدى: <b>${fmt(mada)}</b> ﷼\n` +
    `📱 تحويل: <b>${fmt(transfer)}</b> ﷼\n` +
    `━━━━━━━━━━━━━━━\n` +
    `💰 الإجمالي: <b>${fmt(total)} ﷼</b>`;
  return sendTelegram(msg);
}

/**
 * إشعار: مصروف جديد — يُرسل فقط لو المُسجِّل موظف
 */
export async function notifyTelegramExpenseAdded({ date, branchId, categoryName, amount, paymentMethodId, notes }) {
  // Batch 40: فلترة — للموظفين فقط
  const isEmp = await isCurrentUserEmployee();
  if (!isEmp) return;

  const user = await getCurrentUserName();
  let msg =
    `💸 <b>مصروف جديد</b>\n` +
    `${branchLabel(branchId)}\n` +
    `━━━━━━━━━━━━━━━\n` +
    `👤 المُسجِّل: ${user}\n` +
    `📅 التاريخ: ${date}\n\n` +
    `📂 التصنيف: <b>${categoryName || '—'}</b>\n` +
    `💸 المبلغ: <b>${fmt(amount)} ﷼</b>\n` +
    `💳 الدفع: ${payMethodLabel(paymentMethodId)}`;
  if (notes && notes.trim()) {
    msg += `\n📝 ملاحظات: ${notes.trim()}`;
  }
  return sendTelegram(msg);
}

// ====================================================================
// Batch 47: إشعار Telegram لـ عملاء واتساب
// يُرسل عند الإضافة فقط (مثل المبيعات والمصاريف)
// يعرض: عدد العملاء + الجدد + المشترين + النسبة + تحقق الهدف (20%)
// ====================================================================

/**
 * يحوّل YYYY-MM-DD إلى صيغة عربية مقروءة "25 مايو 2026"
 */
function formatDateArabic(dateStr) {
  if (!dateStr) return '—';
  try {
    const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
                    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    const [y, m, d] = dateStr.split('-').map(Number);
    return `${d} ${months[m - 1]} ${y}`;
  } catch {
    return dateStr;
  }
}

/**
 * إشعار: تسجيل عملاء واتساب جديد — يُرسل فقط لو المُسجِّل موظف
 * Batch 49: يستخدم whatsappTarget من goal الشهر (بدل 20% الثابت)
 */
export async function notifyTelegramWhatsappAdded({ date, branchId, customers, newCustomers, buyers }) {
  // فلترة: للموظفين فقط (المدير لا يحتاج إشعار نفسه)
  const isEmp = await isCurrentUserEmployee();
  if (!isEmp) return;

  const customersN = Number(customers) || 0;
  const newCustomersN = Number(newCustomers) || 0;
  const buyersN = Number(buyers) || 0;
  // نسبة الشراء = مشترين / إجمالي العملاء × 100
  const buyersPct = customersN > 0 ? Math.round((buyersN / customersN) * 100) : 0;

  // Batch 49: نجلب الهدف من goal الشهر
  // Batch 55: يدعم نوعين — نسبة (pct) أو مبلغ/عدد مشترين (amount)
  const monthStr = date.slice(0, 7); // YYYY-MM
  let goalLine;
  try {
    const goal = await getMonthlyGoal(branchId, monthStr);
    const target = Number(goal.whatsappTarget) || 0;
    const targetType = goal.whatsappTargetType === 'amount' ? 'amount' : 'pct';

    if (target <= 0) {
      goalLine = `🎯 الهدف: لم يُحدّد`;
    } else if (targetType === 'amount') {
      // Batch 55: هدف "مبلغ" = مبلغ ريالي من مبيعات التحويل (أونلاين) للشهر
      // التحقيق نسبة وتناسب: مبيعات التحويل المحقّقة ÷ الهدف
      let monthTransfer = 0;
      try {
        const monthSales = await getSales(`${monthStr}-01`, `${monthStr}-31`, branchId);
        monthTransfer = monthSales.reduce((sum, s) => sum + (Number(s.transfer) || 0), 0);
      } catch { /* fallback: نعرض الهدف فقط دون تقدّم */ }
      const targetMet = monthTransfer >= target;
      goalLine = targetMet
        ? `🎯 هدف التحويل (${fmt(target)} ﷼): ✅ ${fmt(monthTransfer)}/${fmt(target)} — تحقق!`
        : `🎯 هدف التحويل (${fmt(target)} ﷼): ${fmt(monthTransfer)}/${fmt(target)} هذا الشهر`;
    } else {
      // هدف "نسبة" = % المشترين من العملاء (السلوك الأصلي — لكل إدخال)
      const targetMet = buyersPct >= target;
      goalLine = targetMet
        ? `🎯 الهدف (${target}%): ✅ تحقق وتجاوز!`
        : `🎯 الهدف (${target}%): ❌ لم يتحقق`;
    }
  } catch {
    goalLine = `🎯 الهدف: لم يُحدّد`;
  }

  const branchName = branchId === 'toia' ? 'تويا' : branchId === 'wardana' ? 'وردانة' : branchId;

  const msg =
    `💬 <b>عملاء واتساب - فرع ${branchName}</b>\n` +
    `━━━━━━━━━━━━━━━\n` +
    `📅 التاريخ: ${formatDateArabic(date)}\n\n` +
    `👥 إجمالي العملاء: <b>${fmt(customersN)}</b>\n` +
    `✨ عملاء جدد: <b>${fmt(newCustomersN)}</b>\n` +
    `🛒 عدد المشترين: <b>${fmt(buyersN)}</b>\n` +
    `📊 نسبة الشراء: <b>${buyersPct}%</b>\n\n` +
    goalLine;
  return sendTelegram(msg);
}
