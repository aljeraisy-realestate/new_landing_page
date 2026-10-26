const demo = {
  ar: {
    request: 'تسجيل طلب', chat: 'محادثة الطلب', invoice: 'تفاصيل الفاتورة',
    requestIntro: 'تجربة إهداء متكاملة\nصِف هديتك… والباقي علينا ♥',
    description: 'وصف الهدية', gift: 'باقة ورد وكيكة صغيرة لعيد ميلاد أمي، مع بطاقة مكتوب فيها: كل عام وأنتِ بخير ♥',
    attachments: 'إضافة مرفقات', addPhoto: 'إضافة صورة', destination: 'جهة الاستلام', city: 'الرياض',
    date: 'تاريخ التسليم', dateValue: 'اختر يوم المناسبة', send: 'إرسال الطلب',
    courier: 'مندوب الهدية', online: 'محادثة داخل التطبيق', today: 'اليوم',
    messageOne: 'ممكن تضيف بطاقة مكتوب فيها: كل عام وأنتِ بخير يا أمي؟',
    messageTwo: 'أكيد، نضيفها مع الورد. أرسل لك الفاتورة بالتفاصيل قبل التجهيز.',
    messageThree: 'هذا شكل التغليف المقترح للهدية.', messageFour: 'جميل، شكراً على الاهتمام بالتفاصيل ♥',
    composer: 'اكتب رسالتك…', invoiceReady: 'فاتورة الطلب', invoiceHint: 'راجع البنود والتكلفة',
    summary: 'ملخص الفاتورة', number: 'فاتورة توضيحية', pending: 'بانتظار المراجعة',
    unit: 'سعر الوحدة', quantity: 'الكمية: 1', cake: 'كيكة صغيرة', flowers: 'باقة ورد',
    delivery: 'رسوم التوصيل', service: 'رسوم الخدمة', total: 'الإجمالي', currency: 'ر.س',
    review: 'مراجعة الفاتورة', invoiceNote: 'راجع التفاصيل مع المندوب قبل المتابعة.',
    label: 'معاينة توضيحية مبنية على شاشة التطبيق، ببيانات مثال.',
  },
  en: {
    request: 'Create a request', chat: 'Order conversation', invoice: 'Invoice details',
    requestIntro: 'A thoughtful gifting experience.\nDescribe your gift. We’ll help with the rest ♥',
    description: 'Gift description', gift: 'Flowers and a small birthday cake for Mom, with a card that says: Happy birthday, Mom ♥',
    attachments: 'Attachments', addPhoto: 'Add a photo', destination: 'Delivery city', city: 'Riyadh',
    date: 'Delivery date', dateValue: 'Choose the occasion date', send: 'Send request',
    courier: 'Your gift courier', online: 'In-app conversation', today: 'Today',
    messageOne: 'Could you add a card saying “Happy birthday, Mom”?',
    messageTwo: 'Of course. I’ll include it with the flowers and send the itemized invoice before preparing the gift.',
    messageThree: 'Here’s an idea for the gift wrapping.', messageFour: 'Lovely. Thank you for taking care of the details ♥',
    composer: 'Write a message…', invoiceReady: 'Order invoice', invoiceHint: 'Review the items and cost',
    summary: 'Invoice summary', number: 'Illustrative invoice', pending: 'Awaiting review',
    unit: 'Unit price', quantity: 'Quantity: 1', cake: 'Small birthday cake', flowers: 'Flower bouquet',
    delivery: 'Delivery fee', service: 'Service fee', total: 'Total', currency: 'SAR',
    review: 'Review invoice', invoiceNote: 'Check the details with your courier before proceeding.',
    label: 'Illustrative preview based on the mobile screen, with sample details.',
  },
};

function TinyIcon({ type }) {
  const paths = {
    back: 'm14 6-6 6 6 6',
    plus: 'M12 5v14M5 12h14',
    calendar: 'M5 5h14v15H5zM8 3v4M16 3v4M5 10h14',
    chat: 'M4 4h16v12H9l-5 4V4ZM8 8h8M8 12h5',
    send: 'm4 4 17 8-17 8 4-8-4-8ZM8 12h13',
    receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3ZM9 7h6M9 11h6',
    location: 'M18 9c0 5-6 11-6 11S6 14 6 9a6 6 0 1 1 12 0ZM12 7v4',
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[type] || paths.receipt} /></svg>;
}

export default function MobilePreview({ id, language = 'ar' }) {
  const c = demo[language];
  return <div className="mobile-canvas"><div className={`mobile-preview mobile-preview-${id}`} lang={language} dir={language === 'ar' ? 'rtl' : 'ltr'} role="img" aria-label={`${c[id]}. ${c.label}`}>
    <div className="demo-status" dir="ltr"><b>9:41</b><span aria-hidden="true">▮▮▮ ◒ ▰</span></div>
    <div className="demo-header"><TinyIcon type={id === 'chat' ? 'chat' : 'receipt'} /><strong>{c[id]}</strong><TinyIcon type="back" /></div>
    {id === 'request' && <div className="demo-request-body">
      <h3>{c.requestIntro}</h3>
      <div className="demo-field"><strong>{c.description}</strong><div className="demo-description">{c.gift}</div></div>
      <div className="demo-attachment"><strong>{c.attachments}</strong><span><TinyIcon type="plus" />{c.addPhoto}</span></div>
      <div className="demo-field"><strong>{c.destination}</strong><div className="demo-input"><span>{c.city}</span><TinyIcon type="location" /></div></div>
      <div className="demo-field"><strong>{c.date}</strong><div className="demo-input"><span>{c.dateValue}</span><TinyIcon type="calendar" /></div></div>
      <span className="demo-action">{c.send}</span>
    </div>}
    {id === 'chat' && <>
      <div className="demo-chat-person"><span className="demo-avatar"><TinyIcon type="chat" /></span><div><strong>{c.courier}</strong><small>{c.online}</small></div><span className="demo-order-id" dir="ltr">ORD-DEMO</span></div>
      <div className="demo-conversation"><span className="demo-day">{c.today}</span><div className="demo-bubble outgoing">{c.messageOne}<small dir="ltr">10:08 ✓✓</small></div><div className="demo-bubble incoming">{c.messageTwo}<small dir="ltr">10:10</small></div><div className="demo-bubble incoming photo-message"><p>{c.messageThree}</p><img src="/artwork/gifts.png" alt="" width="300" height="188" /><small dir="ltr">10:11</small></div><div className="demo-bubble outgoing">{c.messageFour}<small dir="ltr">10:12 ✓✓</small></div></div>
      <div className="demo-chat-invoice"><TinyIcon type="receipt" /><div><strong>{c.invoiceReady}</strong><small>{c.invoiceHint}</small></div></div><div className="demo-composer"><TinyIcon type="plus" /><span>{c.composer}</span><i><TinyIcon type="send" /></i></div>
    </>}
    {id === 'invoice' && <div className="demo-invoice-body"><div className="demo-invoice-card"><div className="demo-summary-heading"><strong>{c.summary}</strong><b lang="en">Giftly</b></div><div className="demo-invoice-meta"><small>{c.number}</small><span>{c.pending}</span></div><small className="demo-unit">{c.unit}</small>{[[c.cake, '120'], [c.flowers, '45']].map(([title, price]) => <div className="demo-invoice-item" key={title}><div><strong>{title}</strong><small>{c.quantity}</small></div><bdi>{price} {c.currency}</bdi></div>)}<div className="demo-fees"><div><span>{c.delivery}</span><bdi>20 {c.currency}</bdi></div><div><span>{c.service}</span><bdi>10 {c.currency}</bdi></div></div><div className="demo-total"><strong>{c.total}</strong><bdi>195 {c.currency}</bdi></div></div><p className="demo-invoice-note">{c.invoiceNote}</p><span className="demo-action">{c.review}</span></div>}
    <div className="demo-home-bar" aria-hidden="true" />
  </div></div>;
}
