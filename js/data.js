// Seed catalog: used once to fill the database on first start. Manage products in Admin → Products.
const IMG = (id, w = 800) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

window.HERO_IMG = IMG("photo-1489987707025-afc232f7ea0f", 1400);

window.PRODUCTS = [
  { id: 1, cat: "jackets", price: 349, oldPrice: 429, rating: 3.8, isNew: true, img: IMG("photo-1551028719-00167b16eac5") },
  { id: 2, cat: "hats", price: 39, oldPrice: 49, rating: 4.1, isNew: true, img: IMG("photo-1588850561407-ed78c282e89b") },
  { id: 3, cat: "tshirts", price: 29, rating: 4.6, img: IMG("photo-1521572163474-6864f9cf17ab") },
  { id: 4, cat: "hoodies", price: 89, oldPrice: 110, rating: 4.4, isNew: true, img: IMG("photo-1556821840-3a63f95609a7") },
  { id: 5, cat: "pants", price: 119, rating: 4.7, img: IMG("photo-1542272604-787c3835535d") },
  { id: 6, cat: "shirts", price: 79, rating: 4.3, img: IMG("photo-1596755094514-f87e34085b2c") },
  { id: 7, cat: "shoes", price: 159, oldPrice: 189, rating: 4.8, img: IMG("photo-1549298916-b41d501d3772") },
  { id: 8, cat: "shoes", price: 229, rating: 4.9, isNew: true, img: IMG("photo-1608256246200-53e635b5b65f") },
  { id: 9, cat: "jackets", price: 299, rating: 4.5, img: IMG("photo-1544923246-77307dd654cb") },
  { id: 10, cat: "shirts", price: 85, rating: 4.2, img: IMG("photo-1602810318383-e386cc2a3ccf") },
  { id: 11, cat: "tshirts", price: 35, rating: 4.4, img: IMG("photo-1583743814966-8936f5b7be1a") },
  { id: 12, cat: "jackets", price: 210, oldPrice: 260, rating: 4.3, img: IMG("photo-1591047139829-d91aecb6caea") },
  { id: 13, cat: "pants", price: 95, rating: 4.1, img: IMG("photo-1624378439575-d8705ad7ae80") },
  { id: 14, cat: "hoodies", price: 129, rating: 4.6, img: IMG("photo-1614975059251-992f11792b9f") },
  { id: 15, cat: "hats", price: 59, rating: 4.0, img: IMG("photo-1521369909029-2afed882baee") },
  { id: 16, cat: "shoes", price: 139, rating: 4.5, img: IMG("photo-1600185365483-26d7a4cc7519") }
];

window.CATEGORIES = ["tshirts", "hoodies", "jackets", "pants", "shirts", "shoes", "hats"];
