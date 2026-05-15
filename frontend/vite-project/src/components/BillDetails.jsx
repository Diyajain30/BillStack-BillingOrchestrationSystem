export default function BillDetails({ bill }) {
  if (!bill) return <div className="p-10 text-gray-400">Select an event to view details</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Receipt Image Section */}
      <div className="bg-white p-4 rounded-xl shadow-md border border-gray-100">
        <h3 className="font-bold text-gray-700 mb-4 uppercase text-xs tracking-widest">Receipt Preview</h3>
        <div className="aspect-[3/4] bg-gray-100 rounded flex items-center justify-center border-2 border-dashed border-gray-200">
          <span className="text-gray-400 text-sm italic">[ Receipt Image Will Load Here ]</span>
        </div>
      </div>

      {/* Metadata Section */}
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-blue-500">
          <h3 className="font-bold text-gray-700 mb-4 uppercase text-xs tracking-widest">Bill Metadata</h3>
          <div className="space-y-4">
            <div>
              <p className="text-gray-500 text-xs">Total Amount</p>
              <p className="text-2xl font-bold text-slate-800">₹{bill.amount}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Category</p>
              <p className="font-medium text-slate-700">{bill.category}</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button className="flex-1 bg-red-50 text-red-600 font-bold py-3 rounded-lg border border-red-200 hover:bg-red-100 transition">
            Reject
          </button>
          <button className="flex-1 bg-green-600 text-white font-bold py-3 rounded-lg shadow-lg hover:bg-green-700 transition">
            Approve Bill
          </button>
        </div>
      </div>
    </div>
  );
}