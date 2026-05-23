// src/hooks/useDragSort.js
// ----------------------------------------------------------
// Batch 22: Hook لإعادة ترتيب القوائم بالسحب — يعمل على Desktop (mouse) و Mobile (touch)
//
// الاستخدام:
//   const drag = useDragSort(items, setItems, async (newOrder) => {
//     await reorderInFirestore(newOrder.map((it) => it.id));
//   });
//
//   {items.map((it, idx) => (
//     <div
//       key={it.id}
//       {...drag.itemProps(idx)}
//       className={drag.isDragging(idx) ? 'opacity-50' : ''}
//     >
//       {it.name}
//       <span {...drag.handleProps(idx)}>⋮⋮</span>
//     </div>
//   ))}
// ----------------------------------------------------------
import { useRef, useState, useCallback } from 'react';

export function useDragSort(items, setItems, onPersist) {
  const [dragIdx, setDragIdx] = useState(null);
  const touchData = useRef({ startY: 0, currentIdx: null, items: null });

  // مشترك لـ desktop و mobile
  const beginDrag = useCallback((idx) => {
    setDragIdx(idx);
    touchData.current.currentIdx = idx;
    touchData.current.items = [...items];
  }, [items]);

  const moveTo = useCallback((targetIdx) => {
    if (touchData.current.currentIdx === null) return;
    if (touchData.current.currentIdx === targetIdx) return;
    const cur = touchData.current.items || items;
    const arr = [...cur];
    const [moved] = arr.splice(touchData.current.currentIdx, 1);
    arr.splice(targetIdx, 0, moved);
    setItems(arr);
    touchData.current.items = arr;
    touchData.current.currentIdx = targetIdx;
    setDragIdx(targetIdx);
  }, [items, setItems]);

  const endDrag = useCallback(async () => {
    const finalItems = touchData.current.items;
    setDragIdx(null);
    touchData.current.currentIdx = null;
    touchData.current.items = null;
    if (onPersist && finalItems) {
      try { await onPersist(finalItems); } catch { /* caller handles */ }
    }
  }, [onPersist]);

  // ===== HTML5 drag (Desktop) =====
  const handleDragStart = useCallback((idx) => beginDrag(idx), [beginDrag]);
  const handleDragOver = useCallback((e, idx) => {
    e.preventDefault();
    moveTo(idx);
  }, [moveTo]);
  const handleDragEnd = useCallback(() => endDrag(), [endDrag]);

  // ===== Touch events (Mobile) =====
  // Long-press لـ ~500ms على المقبض → يبدأ الـ drag
  const longPressTimer = useRef(null);
  const lastTouchY = useRef(0);

  const handleTouchStart = useCallback((e, idx) => {
    lastTouchY.current = e.touches[0].clientY;
    longPressTimer.current = setTimeout(() => {
      beginDrag(idx);
      // Haptic feedback لو متاح
      if (navigator.vibrate) navigator.vibrate(40);
    }, 350);
  }, [beginDrag]);

  const handleTouchMove = useCallback((e) => {
    if (longPressTimer.current && touchData.current.currentIdx === null) {
      // قبل ما يبدأ الـ drag، لو تحرّك كثير نلغي الـ long-press (هذا scroll عادي)
      const dy = Math.abs(e.touches[0].clientY - lastTouchY.current);
      if (dy > 8) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      return;
    }
    if (touchData.current.currentIdx === null) return;
    // الـ drag نشط — نمنع scroll
    e.preventDefault();
    const touch = e.touches[0];
    // نلاقي العنصر تحت الإصبع
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!el) return;
    const sortItem = el.closest('[data-drag-idx]');
    if (!sortItem) return;
    const targetIdx = parseInt(sortItem.getAttribute('data-drag-idx'), 10);
    if (!isNaN(targetIdx)) moveTo(targetIdx);
  }, [moveTo]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (touchData.current.currentIdx !== null) {
      endDrag();
    }
  }, [endDrag]);

  // Props جاهزة للاستخدام
  const itemProps = useCallback((idx) => ({
    'data-drag-idx': idx,
    draggable: true,
    onDragStart: () => handleDragStart(idx),
    onDragOver: (e) => handleDragOver(e, idx),
    onDragEnd: handleDragEnd,
  }), [handleDragStart, handleDragOver, handleDragEnd]);

  // مقبض السحب — للموبايل (touch events)
  const handleProps = useCallback((idx) => ({
    onTouchStart: (e) => handleTouchStart(e, idx),
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    onTouchCancel: handleTouchEnd,
    style: { touchAction: 'none' }, // يمنع scroll أثناء الـ drag
  }), [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const isDragging = useCallback((idx) => dragIdx === idx, [dragIdx]);

  return { itemProps, handleProps, isDragging, dragIdx };
}
