// Product catalog + translations
const IMG = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=80`;

window.PRODUCTS = [
  { id: 1, cat: "shirts", price: 89, oldPrice: 120, img: IMG("photo-1602810318383-e386cc2a3ccf"), en: "Oxford Cotton Shirt", ar: "قميص أكسفورد قطني", badge: "sale" },
  { id: 2, cat: "jackets", price: 249, img: IMG("photo-1551028719-00167b16eac5"), en: "Leather Biker Jacket", ar: "جاكيت جلد", badge: "new" },
  { id: 3, cat: "suits", price: 599, img: IMG("photo-1594938298603-c8148c4dae35"), en: "Tailored Wool Suit", ar: "بدلة صوف مفصلة" },
  { id: 4, cat: "pants", price: 110, img: IMG("photo-1624378439575-d8705ad7ae80"), en: "Slim Chino Trousers", ar: "بنطال تشينو ضيق" },
  { id: 5, cat: "knitwear", price: 139, img: IMG("photo-1614975059251-992f11792b9f"), en: "Merino Crew Sweater", ar: "كنزة ميرينو", badge: "new" },
  { id: 6, cat: "jackets", price: 320, oldPrice: 399, img: IMG("photo-1544923246-77307dd654cb"), en: "Classic Wool Overcoat", ar: "معطف صوف كلاسيكي", badge: "sale" },
  { id: 7, cat: "shirts", price: 75, img: IMG("photo-1596755094514-f87e34085b2c"), en: "Linen Summer Shirt", ar: "قميص كتان صيفي" },
  { id: 8, cat: "pants", price: 129, img: IMG("photo-1542272604-787c3835535d"), en: "Selvedge Denim Jeans", ar: "جينز دينم" },
  { id: 9, cat: "knitwear", price: 159, img: IMG("photo-1617137968427-85924c800a22"), en: "Cashmere Polo Knit", ar: "بولو كشمير" },
  { id: 10, cat: "suits", price: 689, img: IMG("photo-1507679799987-c73779587ccf"), en: "Navy Double-Breasted Suit", ar: "بدلة كحلية بصفين" },
  { id: 11, cat: "shirts", price: 95, img: IMG("photo-1598033129183-c4f50c736f10"), en: "Poplin Dress Shirt", ar: "قميص بوبلين رسمي" },
  { id: 12, cat: "jackets", price: 210, img: IMG("photo-1591047139829-d91aecb6caea"), en: "Suede Bomber Jacket", ar: "جاكيت بومبر سويدي" }
];

window.CATEGORIES = ["shirts", "jackets", "suits", "pants", "knitwear"];

window.I18N = {
  en: {
    brand: "STORE", home: "Home", shop: "Shop", about: "About", contact: "Contact", cart: "Cart",
    announce: "Free shipping on orders over $150 — Complimentary returns",
    heroKicker: "Autumn / Winter Collection",
    heroTitle: "Premium Menswear for the Modern Gentleman",
    heroText: "Elevate your wardrobe with timeless pieces crafted for distinction.",
    shopNow: "Shop Now", explore: "Explore Collection",
    categories: "Shop by Category", featured: "Featured Products", viewAll: "View All",
    shirts: "Shirts", jackets: "Jackets", suits: "Suits", pants: "Trousers", knitwear: "Knitwear", all: "All",
    new: "New", sale: "Sale", addToCart: "Add to Cart", added: "Added ✓",
    f1t: "Free Shipping", f1d: "On all orders over $150",
    f2t: "Easy Returns", f2d: "30-day return policy",
    f3t: "Secure Payment", f3d: "100% protected checkout",
    f4t: "Crafted Quality", f4d: "Premium fabrics only",
    bannerTitle: "The Tailoring Edit", bannerText: "Sharp suits and structured outerwear, cut to perfection.",
    newsletter: "Join the Club", newsletterText: "Subscribe for early access to new drops and exclusive offers.",
    email: "Your email address", subscribe: "Subscribe", subscribed: "Thank you for subscribing!",
    footerText: "Premium menswear for the modern gentleman.",
    help: "Help", shipping: "Shipping", returns: "Returns", faq: "FAQ", rights: "All rights reserved.",
    sort: "Sort", sortDefault: "Featured", sortLow: "Price: Low to High", sortHigh: "Price: High to Low",
    search: "Search products...", products: "products", noResults: "No products found.",
    size: "Size", qty: "Quantity", description: "Description",
    productDesc: "Made from carefully sourced premium materials, this piece combines a modern fit with timeless design. Finished with attention to every detail for everyday distinction.",
    related: "You May Also Like",
    yourCart: "Your Cart", emptyCart: "Your cart is empty.", continueShopping: "Continue Shopping",
    subtotal: "Subtotal", shippingFee: "Shipping", free: "Free", total: "Total", checkout: "Checkout",
    remove: "Remove", orderPlaced: "This is a demo store — checkout is not connected to payments.",
    aboutTitle: "Our Story",
    aboutText: "STORE was founded on a simple belief: every man deserves clothing that fits perfectly and lasts for years. We work with skilled makers and premium mills to create pieces that balance classic tailoring with modern ease.",
    contactTitle: "Get in Touch", name: "Name", message: "Message", send: "Send Message", sent: "Message sent. We'll reply soon!"
  },
  ar: {
    brand: "STORE", home: "الرئيسية", shop: "المتجر", about: "من نحن", contact: "تواصل", cart: "السلة",
    announce: "شحن مجاني للطلبات فوق 150$ — إرجاع مجاني",
    heroKicker: "مجموعة الخريف / الشتاء",
    heroTitle: "أزياء رجالية فاخرة للرجل العصري",
    heroText: "ارتقِ بخزانتك مع قطع خالدة صُممت للتميّز.",
    shopNow: "تسوق الآن", explore: "استكشف المجموعة",
    categories: "تسوق حسب الفئة", featured: "منتجات مميزة", viewAll: "عرض الكل",
    shirts: "قمصان", jackets: "جاكيتات", suits: "بدلات", pants: "بناطيل", knitwear: "تريكو", all: "الكل",
    new: "جديد", sale: "تخفيض", addToCart: "أضف إلى السلة", added: "تمت الإضافة ✓",
    f1t: "شحن مجاني", f1d: "للطلبات فوق 150$",
    f2t: "إرجاع سهل", f2d: "سياسة إرجاع 30 يوماً",
    f3t: "دفع آمن", f3d: "دفع محمي 100%",
    f4t: "جودة عالية", f4d: "أقمشة فاخرة فقط",
    bannerTitle: "تشكيلة التفصيل", bannerText: "بدلات أنيقة ومعاطف مفصلة بإتقان.",
    newsletter: "انضم إلى النادي", newsletterText: "اشترك للحصول على وصول مبكر للمجموعات الجديدة والعروض الحصرية.",
    email: "بريدك الإلكتروني", subscribe: "اشترك", subscribed: "شكراً لاشتراكك!",
    footerText: "أزياء رجالية فاخرة للرجل العصري.",
    help: "المساعدة", shipping: "الشحن", returns: "الإرجاع", faq: "الأسئلة الشائعة", rights: "جميع الحقوق محفوظة.",
    sort: "ترتيب", sortDefault: "مميز", sortLow: "السعر: من الأقل", sortHigh: "السعر: من الأعلى",
    search: "ابحث عن منتجات...", products: "منتج", noResults: "لا توجد منتجات.",
    size: "المقاس", qty: "الكمية", description: "الوصف",
    productDesc: "مصنوعة من مواد فاخرة مختارة بعناية، تجمع هذه القطعة بين القصة العصرية والتصميم الخالد، مع اهتمام بكل التفاصيل.",
    related: "قد يعجبك أيضاً",
    yourCart: "سلة التسوق", emptyCart: "سلتك فارغة.", continueShopping: "متابعة التسوق",
    subtotal: "المجموع الفرعي", shippingFee: "الشحن", free: "مجاني", total: "الإجمالي", checkout: "إتمام الشراء",
    remove: "إزالة", orderPlaced: "هذا متجر تجريبي — الدفع غير مفعّل.",
    aboutTitle: "قصتنا",
    aboutText: "تأسس STORE على فكرة بسيطة: كل رجل يستحق ملابس مثالية المقاس تدوم لسنوات. نعمل مع حرفيين ومصانع فاخرة لصنع قطع تجمع بين التفصيل الكلاسيكي والراحة العصرية.",
    contactTitle: "تواصل معنا", name: "الاسم", message: "الرسالة", send: "إرسال", sent: "تم إرسال رسالتك. سنرد قريباً!"
  }
};
