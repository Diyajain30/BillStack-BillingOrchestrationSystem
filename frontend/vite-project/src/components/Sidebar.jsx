import { MOCK_WINGS } from "../mock/data";

export default function Sidebar({ onSelectEvent }) { // Add prop here
  return (
    <aside className="w-64 bg-slate-900 text-slate-300 h-screen p-4">
      <h1 className="text-white font-bold text-xl mb-8 tracking-tight">BILLSTACK</h1>
      <nav>
        {MOCK_WINGS.map(wing => (
          <div key={wing.id} className="mb-6">
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold mb-3">
              {wing.name}
            </div>
            <ul className="space-y-2">
              {wing.subEvents.map(event => (
                <li 
                  key={event.id} 
                  onClick={() => onSelectEvent(event)} // Trigger the selection
                  className="hover:bg-slate-800 hover:text-white p-2 rounded-md cursor-pointer transition-all text-sm"
                >
                  {event.name}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}