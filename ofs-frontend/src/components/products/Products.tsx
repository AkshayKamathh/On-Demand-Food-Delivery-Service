"use client";
import { useState } from "react";
import { Search } from "lucide-react";
import { useCart } from "../../context/CartContext";

export function Products() {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const { addItem } = useCart();

  const categories = ["All", "Fruits", "Vegetables", "Dairy", "Bakery", "Meat", "Pantry"];

  const products = [
    { id: 1, name: "Organic Apples", category: "Fruits", price: 4.99, unit: "lb", image: "🍎" },
    { id: 2, name: "Fresh Tomatoes", category: "Vegetables", price: 3.49, unit: "lb", image: "🍅" },
    { id: 3, name: "Whole Milk", category: "Dairy", price: 5.99, unit: "gal", image: "🥛" },
    { id: 4, name: "Sourdough Bread", category: "Bakery", price: 6.99, unit: "loaf", image: "🍞" },
    { id: 5, name: "Organic Bananas", category: "Fruits", price: 2.99, unit: "lb", image: "🍌" },
    { id: 6, name: "Fresh Carrots", category: "Vegetables", price: 2.49, unit: "lb", image: "🥕" },
    { id: 7, name: "Cheddar Cheese", category: "Dairy", price: 7.99, unit: "lb", image: "🧀" },
    { id: 8, name: "Croissants", category: "Bakery", price: 4.99, unit: "6 pack", image: "🥐" },
    { id: 9, name: "Fresh Oranges", category: "Fruits", price: 5.99, unit: "lb", image: "🍊" },
    { id: 10, name: "Broccoli", category: "Vegetables", price: 3.99, unit: "lb", image: "🥦" },
    { id: 11, name: "Free-Range Eggs", category: "Dairy", price: 6.49, unit: "dozen", image: "🥚" },
    { id: 12, name: "Blueberry Muffins", category: "Bakery", price: 5.99, unit: "4 pack", image: "🧁" },
    { id: 13, name: "Ground Beef", category: "Meat", price: 8.99, unit: "lb", image: "🥩" },
    { id: 14, name: "Chicken Breast", category: "Meat", price: 9.99, unit: "lb", image: "🍗" },
    { id: 15, name: "Pasta", category: "Pantry", price: 3.49, unit: "box", image: "🍝" },
    { id: 16, name: "Olive Oil", category: "Pantry", price: 12.99, unit: "bottle", image: "🫒" },
  ];

  const filteredProducts = selectedCategory === "All" 
    ? products 
    : products.filter(p => p.category === selectedCategory);

  const handleAddToCart = (product: typeof products[0]) => {
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      unit: product.unit,
      image: product.image,
    });
    alert(`${product.name} added to cart!`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-green-600 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl mb-4">Our Products</h1>
          <p className="text-green-50 text-lg">
            Fresh, quality groceries delivered to your door
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search products..."
              className="w-full pl-12 pr-4 py-3 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {/* Category Filter */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-3">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-6 py-2 rounded-full transition-colors ${
                  selectedCategory === category
                    ? "bg-green-600 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-100"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden"
            >
              <div className="aspect-square bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center text-6xl">
                {product.image}
              </div>
              <div className="p-4">
                <span className="text-xs text-green-600 font-medium">
                  {product.category}
                </span>
                <h3 className="text-lg font-semibold text-gray-900 mt-1">
                  {product.name}
                </h3>
                <div className="flex items-center justify-between mt-3">
                  <div>
                    <span className="text-xl font-bold text-gray-900">
                      ${product.price}
                    </span>
                    <span className="text-sm text-gray-600 ml-1">
                      /{product.unit}
                    </span>
                  </div>
                  <button
                    onClick={() => handleAddToCart(product)}
                    className="bg-green-600 text-white px-4 py-2 rounded-full hover:bg-green-700 transition-colors text-sm"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">No products found in this category.</p>
          </div>
        )}
      </div>
    </div>
  );
}