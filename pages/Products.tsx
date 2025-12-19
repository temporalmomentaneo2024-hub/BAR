import React, { useState, useEffect } from 'react';
import { getProducts, saveProduct, deleteProduct } from '../services/db';
import { Product } from '../types';
import { Plus, Edit2, Trash2, X, Check } from 'lucide-react';

const Products: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Cervezas');
  const [costPrice, setCostPrice] = useState('');
  const [salePrice, setSalePrice] = useState('');

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    const data = await getProducts();
    setProducts(data);
  };

  const openModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setName(product.name);
      setCategory(product.category || product.categoryLabel || 'Sin categoría');
      setCostPrice(product.costPrice.toString());
      setSalePrice(product.salePrice.toString());
    } else {
      setEditingProduct(null);
      setName('');
      setCategory('Cervezas');
      setCostPrice('');
      setSalePrice('');
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // ID generation is now handled in saveProduct if null
    const product: Product = {
      id: editingProduct ? editingProduct.id : '', // Let DB service generate ID if new
      name,
      category,
      categoryLabel: category,
      costPrice: Number(costPrice),
      salePrice: Number(salePrice),
      active: true
    };
    await saveProduct(product);
    setIsModalOpen(false);
    loadProducts();
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Seguro que deseas eliminar este producto?')) {
      await deleteProduct(id);
      loadProducts();
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold text-white">Productos</h2>
          <p className="text-slate-400">Gestiona el inventario y precios</p>
        </div>
        <button
          onClick={() => openModal()}
          className="bg-bar-500 hover:bg-bar-400 text-bar-950 font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus size={20} />
          Nuevo Producto
        </button>
      </div>

      <div className="bg-bar-800 rounded-xl border border-bar-700 overflow-hidden shadow-xl">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-bar-950 text-slate-400 text-sm uppercase tracking-wider">
              <th className="p-4">Nombre</th>
              <th className="p-4">Categoría</th>
              <th className="p-4 text-right">Costo (Interno)</th>
              <th className="p-4 text-right">Venta (Público)</th>
              <th className="p-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-bar-700">
            {products.map((p) => (
              <tr key={p.id} className="hover:bg-bar-700/50 transition-colors">
                <td className="p-4 font-medium text-white">{p.name}</td>
                <td className="p-4 text-slate-400">{p.category}</td>
                <td className="p-4 text-right text-slate-300">${p.costPrice.toLocaleString()}</td>
                <td className="p-4 text-right text-emerald-400 font-medium">${p.salePrice.toLocaleString()}</td>
                <td className="p-4">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => openModal(p)} className="p-2 hover:bg-bar-600 rounded-lg text-slate-300 hover:text-white transition-colors">
                      <Edit2 size={18} />
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="p-2 hover:bg-rose-900/50 rounded-lg text-rose-400 hover:text-rose-200 transition-colors">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">No hay productos registrados.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-bar-800 rounded-2xl w-full max-w-md border border-bar-700 shadow-2xl">
            <div className="p-6 border-b border-bar-700 flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Nombre</label>
                <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-bar-900 border border-bar-600 rounded-lg p-2.5 text-white focus:ring-1 focus:ring-bar-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Categoría</label>
                <select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-bar-900 border border-bar-600 rounded-lg p-2.5 text-white focus:ring-1 focus:ring-bar-500 outline-none">
                  <option value="Cervezas">Cervezas</option>
                  <option value="Licores">Licores</option>
                  <option value="Sin Alcohol">Sin Alcohol</option>
                  <option value="Comida">Comida</option>
                  <option value="Otros">Otros</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Costo ($)</label>
                  <input required type="number" min="0" value={costPrice} onChange={e => setCostPrice(e.target.value)} className="w-full bg-bar-900 border border-bar-600 rounded-lg p-2.5 text-white focus:ring-1 focus:ring-bar-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Venta ($)</label>
                  <input required type="number" min="0" value={salePrice} onChange={e => setSalePrice(e.target.value)} className="w-full bg-bar-900 border border-bar-600 rounded-lg p-2.5 text-white focus:ring-1 focus:ring-bar-500 outline-none" />
                </div>
              </div>
              <button type="submit" className="w-full bg-bar-500 hover:bg-bar-400 text-bar-950 font-bold py-3 rounded-lg mt-4 flex items-center justify-center gap-2">
                <Check size={20} />
                Guardar
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;
