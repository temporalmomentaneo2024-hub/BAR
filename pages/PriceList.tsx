import React, { useState, useEffect } from 'react';
import { getProducts } from '../services/db';
import { Product } from '../types';
import { Search, Tag } from 'lucide-react';

const PriceList: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load products fresh from DB (Source of Truth)
    getProducts().then(data => {
      // Filter only active products for the menu view
      setProducts(data.filter(p => p.active));
      setLoading(false);
    });
  }, []);

  // Incremental Search Filter
  const filteredProducts = products.filter(p => {
    const term = searchTerm.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      p.category.toLowerCase().includes(term)
    );
  });

  if (loading) return <div className="text-slate-400 p-8 text-center">Cargando menú...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4">
        <div>
            <h2 className="text-3xl font-bold text-white">Consulta de Precios</h2>
            <p className="text-slate-400">Buscador rápido para atención al cliente</p>
        </div>
      </div>

      {/* Search Bar - Optimized for touch/speed */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="text-bar-500 h-6 w-6" />
        </div>
        <input
          type="text"
          autoFocus
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="block w-full pl-14 pr-4 py-4 bg-bar-800 border border-bar-600 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-bar-500 focus:border-transparent text-lg shadow-lg transition-all"
          placeholder="Buscar bebida, licor o categoría..."
        />
      </div>

      {/* Results Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProducts.map((product) => (
          <div 
            key={product.id} 
            className="bg-bar-800 rounded-xl p-5 border border-bar-700 shadow-md hover:border-bar-500 transition-colors group flex justify-between items-center"
          >
            <div className="overflow-hidden">
                <h3 className="text-lg font-bold text-white truncate group-hover:text-bar-400 transition-colors">
                    {product.name}
                </h3>
                <div className="flex items-center gap-1.5 mt-1">
                    <Tag size={12} className="text-slate-500" />
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wide bg-bar-900/50 px-2 py-0.5 rounded">
                        {product.category}
                    </span>
                </div>
            </div>
            <div className="text-right pl-4">
                <p className="text-2xl font-bold text-emerald-400">
                    ${product.salePrice.toLocaleString()}
                </p>
                <p className="text-[10px] text-slate-600 uppercase">Precio Venta</p>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredProducts.length === 0 && (
        <div className="text-center py-16 bg-bar-800/50 rounded-xl border border-bar-700/50 border-dashed">
            <Search className="mx-auto h-12 w-12 text-slate-600 mb-4" />
            <h3 className="text-lg font-medium text-slate-300">No se encontraron productos</h3>
            <p className="text-slate-500">Intenta buscar con otro nombre o categoría.</p>
        </div>
      )}
    </div>
  );
};

export default PriceList;