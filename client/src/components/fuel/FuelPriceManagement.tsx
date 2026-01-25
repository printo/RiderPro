// /client/src/components/fuel/FuelPriceManagement.tsx
import React, { useState, useEffect } from 'react';
import { Save, Edit, X } from 'lucide-react';
import { FuelCalculator, FuelPrice, City, FuelType } from '@/services/FuelCalculator';

// Define types for table columns
interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => React.ReactNode;
  className?: string;
}

// Format currency
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

interface FuelPriceManagementProps {
  fuelCalculator: FuelCalculator;
  onPriceUpdate?: () => void;
}

export const FuelPriceManagement: React.FC<FuelPriceManagementProps> = ({ 
  fuelCalculator,
  onPriceUpdate 
}) => {
  const [prices, setPrices] = useState<FuelPrice[]>([]);
  const [editingKey, setEditingKey] = useState<string>('');
  const [editingPrice, setEditingPrice] = useState<Partial<FuelPrice>>({});

  useEffect(() => {
    loadFuelPrices();
  }, []);

  const loadFuelPrices = () => {
    const cities: City[] = ['Delhi', 'Bangalore', 'Chennai'];
    const fuelTypes: FuelType[] = ['gasoline', 'diesel', 'electric'];
    
    const allPrices: FuelPrice[] = [];
    
    cities.forEach(city => {
      fuelTypes.forEach(fuelType => {
        const price = fuelCalculator.getFuelPrice(fuelType, city);
        if (price) {
          allPrices.push(price);
        }
      });
    });
    
    setPrices(allPrices);
  };

  const handleEdit = (record: FuelPrice) => {
    setEditingKey(`${record.fuelType}-${record.city}`);
    setEditingPrice({ ...record });
  };

  const handleSave = async (fuelType: FuelType, city: City) => {
    if (!editingPrice.pricePerUnit) {
      console.error('Price is required');
      return;
    }

    const updatedPrice: FuelPrice = {
      fuelType,
      city,
      pricePerUnit: Number(editingPrice.pricePerUnit),
      gstPercent: editingPrice.gstPercent || 0,
      currency: 'INR',
      lastUpdated: new Date().toISOString()
    };

    try {
      fuelCalculator.updateFuelPrice(updatedPrice);
      setEditingKey('');
      console.log('Price updated successfully');
      loadFuelPrices();
      onPriceUpdate?.();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to update price:', errorMessage);
    }
  };


  // Define table columns
  const columns: Column<FuelPrice>[] = [
    {
      key: 'city',
      header: 'City',
      render: (item) => <span className="font-medium">{item.city}</span>,
      className: 'w-1/6'
    },
    {
      key: 'fuelType',
      header: 'Fuel Type',
      render: (item) => (
        <span className="capitalize">{item.fuelType}</span>
      ),
      className: 'w-1/6'
    },
    {
      key: 'price',
      header: 'Price (INR)',
      render: (item) => {
        const key = `${item.fuelType}-${item.city}`;
        if (editingKey === key) {
          return (
            <input
              type="number"
              className="w-24 px-2 py-1 border rounded"
              value={editingPrice.pricePerUnit || ''}
              onChange={(e) => setEditingPrice({ 
                ...editingPrice, 
                pricePerUnit: parseFloat(e.target.value) || 0
              })}
            />
          );
        }
        return formatCurrency(item.pricePerUnit);
      },
      className: 'w-1/4'
    },
    {
      key: 'gst',
      header: 'GST %',
      render: (item) => {
        const key = `${item.fuelType}-${item.city}`;
        if (editingKey === key) {
          return (
            <input
              type="number"
              className="w-20 px-2 py-1 border rounded"
              value={editingPrice.gstPercent || 0}
              onChange={(e) => setEditingPrice({ 
                ...editingPrice, 
                gstPercent: parseFloat(e.target.value) || 0
              })}
            />
          );
        }
        return `${item.gstPercent}%`;
      },
      className: 'w-1/6'
    },
    {
      key: 'updated',
      header: 'Last Updated',
      render: (item) => new Date(item.lastUpdated).toLocaleString(),
      className: 'w-1/4'
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item) => {
        const key = `${item.fuelType}-${item.city}`;
        if (editingKey === key) {
          return (
            <div className="flex space-x-2">
              <button
                onClick={() => handleSave(item.fuelType, item.city)}
                className="flex items-center px-2 py-1 text-sm text-white bg-blue-600 rounded hover:bg-blue-700"
              >
                <Save size={14} className="mr-1" />
                Save
              </button>
              <button
                onClick={() => setEditingKey('')}
                className="flex items-center px-2 py-1 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
              >
                <X size={14} className="mr-1" />
                Cancel
              </button>
            </div>
          );
        }
        return (
          <button
            onClick={() => handleEdit(item)}
            className="flex items-center px-2 py-1 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
          >
            <Edit size={14} className="mr-1" />
            Edit
          </button>
        );
      },
      className: 'w-1/4'
    }
  ];

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Fuel Price Management</h2>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${column.className}`}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {prices.map((item) => (
              <tr key={`${item.fuelType}-${item.city}`} className="hover:bg-gray-50">
                {columns.map((column) => (
                  <td key={column.key} className="px-6 py-4 whitespace-nowrap text-sm">
                    {column.render(item)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="mt-4 text-sm text-gray-500">
        Last updated: {new Date().toLocaleString()}
      </div>
    </div>
  );
};