import React, { useMemo } from 'react';
//import { Alert, AlertDescription } from '@/components/ui/alert';
import { Package } from 'lucide-react';

interface PackageBox {
  sku?: string;
  name?: string;
  quantity?: number;
  dimensions?: {
    length?: number;
    breadth?: number;
    height?: number;
  };
  length?: number;
  breadth?: number;
  width?: number;
  height?: number;
  weight?: number;
  volume?: number;
  price?: number;
}

interface PackageBoxesTableProps {
  package_boxes: PackageBox[] | null | undefined;
  className?: string;
}

export default function PackageBoxesTable({ package_boxes, className }: PackageBoxesTableProps) {
  // Calculate totals
  const totals = useMemo(() => {
    if (!package_boxes || !Array.isArray(package_boxes) || package_boxes.length === 0) {
      return null;
    }

    interface Totals {
      quantity: number;
      weight: number;
      volume: number;
      price: number;
    }

    const initial: Totals = { quantity: 0, weight: 0, volume: 0, price: 0 };

    return package_boxes.reduce<Totals>((acc, box) => {
      acc.quantity = acc.quantity + (box.quantity ?? 0);
      acc.weight = acc.weight + (box.weight ?? 0);
      acc.volume = acc.volume + (box.volume ?? 0);
      acc.price = acc.price + (box.price ?? 0);
      return acc;
    }, initial);
  }, [package_boxes]);

  if (!package_boxes || !Array.isArray(package_boxes) || package_boxes.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center py-12 px-4 ${className || ''}`}>
        <div className="rounded-full bg-gray-100 dark:bg-gray-800 p-4 mb-4">
          <Package className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">No Package Details</h3>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          No package box details are available for this shipment. Package information will appear here once it's added.
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className || ''}`}>
      <div className="overflow-x-auto -mx-4 px-4">
        <div className="inline-block min-w-full align-middle">
          <div className="overflow-hidden shadow-sm ring-1 ring-black ring-opacity-5 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Box #
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    SKU
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Name
                  </th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Qty
                  </th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Length (cm)
                  </th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Width (cm)
                  </th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Height (cm)
                  </th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Weight (kg)
                  </th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Volume (cm³)
                  </th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Price
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {package_boxes.map((box, index) => (
                  <tr
                    key={index}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                      {index + 1}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                      {box.sku || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                      {box.name || 'Box'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 text-right">
                      {box.quantity || 0}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 text-right">
                      {box.dimensions?.length || box.length || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 text-right">
                      {box.dimensions?.breadth || box.breadth || box.width || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 text-right">
                      {box.dimensions?.height || box.height || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 text-right">
                      {box.weight ? `${box.weight}` : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 text-right">
                      {box.volume ? `${box.volume}` : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100 text-right">
                      {box.price ? `₹${box.price.toLocaleString('en-IN')}` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
              {totals && (
                <tfoot className="bg-gray-100 dark:bg-gray-800 border-t-2 border-gray-300 dark:border-gray-600">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-gray-100">
                      Totals
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-gray-100 text-right">
                      {totals.quantity}
                    </td>
                    <td colSpan={3} className="px-4 py-3"></td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-gray-100 text-right">
                      {totals.weight > 0 ? `${totals.weight.toFixed(2)}` : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-gray-100 text-right">
                      {totals.volume > 0 ? `${totals.volume.toFixed(2)}` : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-gray-100 text-right">
                      {totals.price > 0 ? `₹${totals.price.toLocaleString('en-IN')}` : '-'}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
