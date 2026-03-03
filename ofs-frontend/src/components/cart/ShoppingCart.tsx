import { ShoppingCart, Plus, Minus, Trash2, X } from "lucide-react";
import { useCart } from "../../context/CartContext";
interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const { items, updateQuantity, removeItem, total, clearCart } = useCart();

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-green-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              Your Cart ({items.length})
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-6">
          {items.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 text-lg mb-2">Your cart is empty</p>
              <p className="text-gray-500 text-sm">
                Add some items to get started!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="bg-gray-50 rounded-xl p-4 flex gap-4"
                >
                  {/* Product Image */}
                  <div className="w-20 h-20 bg-gradient-to-br from-green-50 to-green-100 rounded-lg flex items-center justify-center text-3xl flex-shrink-0">
                    {item.image}
                  </div>

                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {item.name}
                    </h3>
                    <p className="text-green-600 text-sm mb-3">
                      ${item.price.toFixed(2)} / {item.unit}
                    </p>

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-300">
                        <button
                          onClick={() =>
                            updateQuantity(item.id, item.quantity - 1)
                          }
                          className="p-2 hover:bg-gray-100 rounded-l-lg transition-colors"
                        >
                          <Minus className="w-4 h-4 text-gray-600" />
                        </button>
                        <span className="w-12 text-center font-medium text-gray-900">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            updateQuantity(item.id, item.quantity + 1)
                          }
                          className="p-2 hover:bg-gray-100 rounded-r-lg transition-colors"
                        >
                          <Plus className="w-4 h-4 text-gray-600" />
                        </button>
                      </div>

                      <button
                        onClick={() => removeItem(item.id)}
                        className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </div>

                  {/* Item Total */}
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      ${(item.price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}

              {/* Clear Cart Button */}
              {items.length > 0 && (
                <button
                  onClick={clearCart}
                  className="w-full text-red-600 hover:text-red-700 text-sm font-medium py-2 transition-colors"
                >
                  Clear Cart
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t p-6 bg-gray-50">
            {/* Subtotal */}
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>${total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Delivery Fee</span>
                <span>{total >= 50 ? "FREE" : "$4.99"}</span>
              </div>
              <div className="border-t pt-2 flex justify-between text-lg font-semibold text-gray-900">
                <span>Total</span>
                <span>${(total + (total >= 50 ? 0 : 4.99)).toFixed(2)}</span>
              </div>
            </div>

            {/* Free Delivery Progress */}
            {total < 50 && (
              <div className="mb-4">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Free delivery at $50</span>
                  <span>${(50 - total).toFixed(2)} to go</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full transition-all"
                    style={{ width: `${(total / 50) * 100}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Checkout Button */}
            <button className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-colors font-medium">
              Proceed to Checkout
            </button>
          </div>
        )}
      </div>
    </>
  );
}
