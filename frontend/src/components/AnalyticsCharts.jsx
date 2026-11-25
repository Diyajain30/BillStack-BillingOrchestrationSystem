import React, { useState, useMemo, useEffect } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';

const PALETTE = [
  '#4d7c5b', // sage-700
  '#7c9a82', // sage-500
  '#d97706', // amber-600
  '#0284c7', // sky-600
  '#7c3aed', // violet-600
  '#db2777', // pink-600
  '#0d9488', // teal-600
  '#ea580c', // orange-600
  '#4f46e5', // indigo-600
  '#a8a29e', // stone-400 (Unallocated / Others)
];

function formatINR(value) {
  return `INR ${Number(value || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 0,
  })}`;
}

function isBillRejectedOrSteppedBack(bill) {
  if (!bill) return false;
  if (bill.status === 'REJECTED') return true;
  return Boolean(bill.rejectionReason || bill.rejectedBy);
}

/**
 * Shared Sub-Event Analytics (Student Coordinator, Faculty Head, and Sub-Event Drill-Down)
 * 1) Semi-circle budget utilization meter (<80% sage, 80-90% orange, >90% red)
 * 2) Vendor expense donut chart (Approved / All toggle, Top 5 + Others)
 * 3) Bill summary bar chart (Total Bills + Approved, In Process, Rejected)
 */
export function SubEventAnalytics({ allocatedBudget = 0, bills = [] }) {
  const [vendorScope, setVendorScope] = useState('approved'); // 'approved' | 'all'

  const approvedSpend = useMemo(
    () =>
      bills
        .filter((b) => b.status === 'APPROVED')
        .reduce((sum, b) => sum + (Number(b.amount) || 0), 0),
    [bills]
  );

  const inProcessSpend = useMemo(
    () =>
      bills
        .filter(
          (b) => b.status !== 'APPROVED' && !isBillRejectedOrSteppedBack(b)
        )
        .reduce((sum, b) => sum + (Number(b.amount) || 0), 0),
    [bills]
  );

  const rawPct =
    allocatedBudget > 0 ? (approvedSpend / allocatedBudget) * 100 : 0;
  const clampedPct = Math.min(Math.max(rawPct, 0), 100);

  const gaugeColor =
    rawPct > 90 ? '#e11d48' : rawPct >= 80 ? '#f97316' : '#4d7c5b';
  const gaugeStatusLabel =
    rawPct > 90
      ? 'Critical (> 90%)'
      : rawPct >= 80
      ? 'Warning (80% – 90%)'
      : 'Healthy (< 80%)';
  const gaugeBadgeClass =
    rawPct > 90
      ? 'bg-rose-50 text-rose-700 border-rose-200'
      : rawPct >= 80
      ? 'bg-orange-50 text-orange-700 border-orange-200'
      : 'bg-sage-100 text-sage-800 border-sage-200';

  const gaugeData = [
    { name: 'Approved Spend', value: clampedPct },
    { name: 'Remaining', value: Math.max(100 - clampedPct, 0) },
  ];

  const { vendorData, totalVendorSpend } = useMemo(() => {
    const filtered =
      vendorScope === 'approved'
        ? bills.filter((b) => b.status === 'APPROVED')
        : bills.filter((b) => !isBillRejectedOrSteppedBack(b));

    const map = {};
    for (const b of filtered) {
      const name = (b.vendorName || 'Unknown Vendor').trim();
      map[name] = (map[name] || 0) + (Number(b.amount) || 0);
    }

    const sorted = Object.entries(map)
      .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);

    let finalList = sorted;
    if (sorted.length > 5) {
      const top5 = sorted.slice(0, 5);
      const othersSum = sorted
        .slice(5)
        .reduce((acc, item) => acc + item.value, 0);
      finalList = [
        ...top5,
        { name: 'Others', value: Number(othersSum.toFixed(2)) },
      ];
    }

    const total = finalList.reduce((acc, item) => acc + item.value, 0);
    return { vendorData: finalList, totalVendorSpend: total };
  }, [bills, vendorScope]);

  const statusStats = useMemo(() => {
    const total = bills.length;
    const approved = bills.filter((b) => b.status === 'APPROVED').length;
    const rejected = bills.filter((b) =>
      isBillRejectedOrSteppedBack(b)
    ).length;
    const inProcess = Math.max(total - approved - rejected, 0);

    return {
      total,
      chartData: [
        { stage: 'Approved', count: approved, fill: '#4d7c5b' },
        { stage: 'In Process', count: inProcess, fill: '#f59e0b' },
        { stage: 'Rejected', count: rejected, fill: '#e11d48' },
      ],
    };
  }, [bills]);

  return (
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-5 min-w-0">
      {/* VISUAL 1: SEMI-CIRCLE BUDGET METER */}
      <div className="min-w-0 bg-white p-5 rounded-xl border border-sage-200 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="text-sm font-semibold text-stone-900">
            Budget Utilization
          </h3>
          <span
            className={`text-[11px] font-medium px-2 py-0.5 rounded-md border shrink-0 ${gaugeBadgeClass}`}
          >
            {gaugeStatusLabel}
          </span>
        </div>

        <div className="relative h-44 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={gaugeData}
                dataKey="value"
                cx="50%"
                cy="82%"
                startAngle={180}
                endAngle={0}
                innerRadius={62}
                outerRadius={86}
                paddingAngle={0}
                stroke="none"
              >
                <Cell fill={gaugeColor} />
                <Cell fill="#e7efe9" />
              </Pie>
              <Tooltip
                formatter={(val, name) => [`${Number(val).toFixed(1)}%`, name]}
              />
            </PieChart>
          </ResponsiveContainer>

          <div className="absolute inset-x-0 bottom-4 text-center pointer-events-none">
            <p
              className="text-2xl font-bold leading-none"
              style={{ color: gaugeColor }}
            >
              {rawPct.toFixed(1)}%
            </p>
            <p className="text-[11px] text-stone-500 mt-1">
              {formatINR(approvedSpend)} / {formatINR(allocatedBudget)}
            </p>
          </div>
        </div>

        <div className="pt-3 border-t border-sage-100 flex items-center justify-between text-[11px] text-stone-500">
          <span>80% Orange &middot; 90% Red</span>
          {inProcessSpend > 0 && (
            <span className="text-amber-700 font-medium">
              +{formatINR(inProcessSpend)} in process
            </span>
          )}
        </div>
      </div>

      {/* VISUAL 2: VENDOR EXPENSE DONUT CHART */}
      <div className="min-w-0 bg-white p-5 rounded-xl border border-sage-200 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="text-sm font-semibold text-stone-900">
            Vendor Expenses
          </h3>
          <div className="inline-flex rounded-md border border-sage-200 bg-sage-50 p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => setVendorScope('approved')}
              className={`px-2 py-0.5 rounded font-medium transition cursor-pointer ${
                vendorScope === 'approved'
                  ? 'bg-white text-sage-900 shadow-xs'
                  : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              Approved
            </button>
            <button
              type="button"
              onClick={() => setVendorScope('all')}
              className={`px-2 py-0.5 rounded font-medium transition cursor-pointer ${
                vendorScope === 'all'
                  ? 'bg-white text-sage-900 shadow-xs'
                  : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              All
            </button>
          </div>
        </div>

        {vendorData.length === 0 ? (
          <div className="h-44 flex items-center justify-center text-xs text-stone-400 text-center px-4">
            {vendorScope === 'approved'
              ? 'No approved vendor bills yet. Switch to "All" to preview submitted bills.'
              : 'No vendor bills uploaded yet.'}
          </div>
        ) : (
          <div className="relative h-44 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={vendorData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={2}
                >
                  {vendorData.map((entry, idx) => (
                    <Cell
                      key={entry.name}
                      fill={PALETTE[idx % PALETTE.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [formatINR(value), 'Spent']}
                  contentStyle={{
                    borderRadius: '8px',
                    borderColor: '#d9e5dc',
                    fontSize: '12px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] text-stone-400">Total</span>
              <span className="text-xs font-bold text-stone-800">
                {formatINR(totalVendorSpend)}
              </span>
            </div>
          </div>
        )}

        <div className="pt-3 border-t border-sage-100 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-stone-600">
          {vendorData.slice(0, 4).map((v, idx) => (
            <span
              key={v.name}
              className="inline-flex items-center gap-1.5 truncate max-w-[120px]"
            >
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{
                  backgroundColor: PALETTE[idx % PALETTE.length],
                }}
              />
              <span className="truncate">{v.name}</span>
            </span>
          ))}
        </div>
      </div>

      {/* VISUAL 3: BILL SUMMARY BAR CHART */}
      <div className="min-w-0 bg-white p-5 rounded-xl border border-sage-200 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="text-sm font-semibold text-stone-900">
            Bill Summary
          </h3>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-sage-50 border border-sage-200 text-stone-700">
            Total Bills: {statusStats.total}
          </span>
        </div>

        <div className="h-44 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={statusStats.chartData}
              layout="vertical"
              margin={{ top: 8, right: 20, left: 6, bottom: 4 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={false}
                stroke="#e7efe9"
              />
              <XAxis
                type="number"
                allowDecimals={false}
                tick={{ fontSize: 11, fill: '#78716c' }}
                axisLine={{ stroke: '#d9e5dc' }}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="stage"
                width={72}
                tick={{ fontSize: 11, fill: '#44403c', fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(value) => [`${value} bill(s)`, 'Count']}
                cursor={{ fill: '#f4f8f5' }}
                contentStyle={{
                  borderRadius: '8px',
                  borderColor: '#d9e5dc',
                  fontSize: '12px',
                }}
              />
              <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={22}>
                {statusStats.chartData.map((entry) => (
                  <Cell key={entry.stage} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="pt-3 border-t border-sage-100 flex items-center justify-between text-[11px] text-stone-500">
          <span className="text-sage-800 font-medium">
            Approved: {statusStats.chartData[0].count}
          </span>
          <span className="text-amber-700 font-medium">
            In Process: {statusStats.chartData[1].count}
          </span>
          <span className="text-rose-700 font-medium">
            Rejected: {statusStats.chartData[2].count}
          </span>
        </div>
      </div>
    </section>
  );
}

/**
 * Shared Master Event & Executive Analytics
 * 1) Master Event budget allocation across sub-events (Donut)
 * 2) Overall approved spend vs. budget semi-circle meter (80% orange, 90% red)
 * 3) Sub-event wise Budget Cap vs. Approved Spend horizontal bar chart
 */
export function MasterEventAnalytics({
  masterEvents = [],
  subEvents = [],
  bills = [],
}) {
  const [selectedMasterId, setSelectedMasterId] = useState(
    masterEvents[0]?.id ? String(masterEvents[0].id) : ''
  );

  useEffect(() => {
    if (
      masterEvents.length > 0 &&
      !masterEvents.some((m) => String(m.id) === String(selectedMasterId))
    ) {
      setSelectedMasterId(String(masterEvents[0].id));
    }
  }, [masterEvents, selectedMasterId]);

  const activeMaster = useMemo(
    () =>
      masterEvents.find((m) => String(m.id) === String(selectedMasterId)) ||
      masterEvents[0] ||
      null,
    [masterEvents, selectedMasterId]
  );

  const childSubEvents = useMemo(() => {
    if (!activeMaster) return [];
    return subEvents.filter(
      (se) => String(se.parentEventId) === String(activeMaster.id)
    );
  }, [subEvents, activeMaster]);

  const childSubEventIds = useMemo(
    () => new Set(childSubEvents.map((se) => String(se.id))),
    [childSubEvents]
  );

  const masterBills = useMemo(
    () =>
      bills.filter((b) => {
        const sid = b.subEventId ?? b.sub_event_id ?? b.eventId ?? b.event_id;
        return sid != null && childSubEventIds.has(String(sid));
      }),
    [bills, childSubEventIds]
  );

  const masterBudgetCap = useMemo(() => {
    const cap = Number(activeMaster?.budgetCap) || 0;
    if (cap > 0) return cap;
    return childSubEvents.reduce(
      (sum, se) => sum + (Number(se.budgetCap) || 0),
      0
    );
  }, [activeMaster, childSubEvents]);

  const approvedSpend = useMemo(
    () =>
      masterBills
        .filter((b) => b.status === 'APPROVED')
        .reduce((sum, b) => sum + (Number(b.amount) || 0), 0),
    [masterBills]
  );

  const inProcessSpend = useMemo(
    () =>
      masterBills
        .filter(
          (b) => b.status !== 'APPROVED' && !isBillRejectedOrSteppedBack(b)
        )
        .reduce((sum, b) => sum + (Number(b.amount) || 0), 0),
    [masterBills]
  );

  // 1) Master Budget Allocation Across Sub-Events (Donut)
  const { allocationSlices, totalAllocatedToSubs } = useMemo(() => {
    const items = childSubEvents
      .map((se) => ({
        name: se.name,
        value: Number(se.budgetCap) || 0,
      }))
      .filter((x) => x.value > 0);

    const allocatedSum = items.reduce((sum, x) => sum + x.value, 0);
    const unallocated = Math.max(masterBudgetCap - allocatedSum, 0);

    const slices =
      unallocated > 0
        ? [
            ...items,
            {
              name: 'Unallocated Buffer',
              value: unallocated,
              isBuffer: true,
            },
          ]
        : items;

    return { allocationSlices: slices, totalAllocatedToSubs: allocatedSum };
  }, [childSubEvents, masterBudgetCap]);

  // 2) Overall Approved Spend vs. Budget Semi-Circle Meter
  const rawPct =
    masterBudgetCap > 0 ? (approvedSpend / masterBudgetCap) * 100 : 0;
  const clampedPct = Math.min(Math.max(rawPct, 0), 100);

  const gaugeColor =
    rawPct > 90 ? '#e11d48' : rawPct >= 80 ? '#f97316' : '#4d7c5b';
  const gaugeStatusLabel =
    rawPct > 90
      ? 'Critical (> 90%)'
      : rawPct >= 80
      ? 'Warning (80% – 90%)'
      : 'Healthy (< 80%)';
  const gaugeBadgeClass =
    rawPct > 90
      ? 'bg-rose-50 text-rose-700 border-rose-200'
      : rawPct >= 80
      ? 'bg-orange-50 text-orange-700 border-orange-200'
      : 'bg-sage-100 text-sage-800 border-sage-200';

  const gaugeData = [
    { name: 'Approved Spend', value: clampedPct },
    { name: 'Remaining', value: Math.max(100 - clampedPct, 0) },
  ];

  // 3) Sub-Event Wise Budget Cap vs. Approved Spend (Horizontal Bar Chart)
  const subEventBarData = useMemo(() => {
    return childSubEvents.map((se) => {
      const spent = masterBills
        .filter(
          (b) =>
            String(b.subEventId ?? b.sub_event_id ?? '') === String(se.id) &&
            b.status === 'APPROVED'
        )
        .reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

      return {
        name: se.name,
        budget: Number(se.budgetCap) || 0,
        spent: Number(spent.toFixed(2)),
      };
    });
  }, [childSubEvents, masterBills]);

  if (!activeMaster) return null;

  const horizontalChartHeight = Math.max(210, subEventBarData.length * 46);

  return (
    <section className="space-y-4 min-w-0">
      {masterEvents.length > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-white px-4 py-3 rounded-xl border border-sage-200 min-w-0">
          <span className="text-xs font-medium text-stone-600">
            Master Event:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {masterEvents.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedMasterId(String(m.id))}
                className={`px-3 py-1 rounded-lg text-xs font-medium border transition cursor-pointer ${
                  String(m.id) === String(activeMaster.id)
                    ? 'bg-sage-600 text-white border-sage-600'
                    : 'bg-sage-50 text-stone-700 border-sage-200 hover:bg-sage-100'
                }`}
              >
                {m.name} {m.eventYear ? `(${m.eventYear})` : ''}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Top Row: Budget Allocation Donut + Spend vs. Budget Semi-Circle Meter */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 min-w-0">
        {/* 1) MASTER BUDGET ALLOCATION ACROSS SUB-EVENTS */}
        <div className="min-w-0 bg-white p-5 rounded-xl border border-sage-200 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-stone-900 truncate">
                Budget Allocation by Sub-Event
              </h3>
              <p className="text-[11px] text-stone-500 truncate">
                {activeMaster.name}
                {activeMaster.eventYear ? ` (${activeMaster.eventYear})` : ''}
              </p>
            </div>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-sage-50 border border-sage-200 text-stone-700 shrink-0">
              {childSubEvents.length} Sub-Event
              {childSubEvents.length === 1 ? '' : 's'}
            </span>
          </div>

          {allocationSlices.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-xs text-stone-400 text-center px-4">
              No sub-event budgets allocated under {activeMaster.name} yet.
            </div>
          ) : (
            <div className="relative h-48 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={allocationSlices}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={74}
                    paddingAngle={2}
                  >
                    {allocationSlices.map((slice, idx) => (
                      <Cell
                        key={slice.name}
                        fill={
                          slice.isBuffer
                            ? '#d6d3d1'
                            : PALETTE[idx % (PALETTE.length - 1)]
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [formatINR(value), name]}
                    contentStyle={{
                      borderRadius: '8px',
                      borderColor: '#d9e5dc',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] text-stone-400">Master Cap</span>
                <span className="text-xs font-bold text-stone-800">
                  {formatINR(masterBudgetCap)}
                </span>
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-sage-100 flex items-center justify-between text-[11px] text-stone-500">
            <span>
              Allocated:{' '}
              <strong className="text-stone-800">
                {formatINR(totalAllocatedToSubs)}
              </strong>
            </span>
            <span>
              Cap:{' '}
              <strong className="text-stone-800">
                {formatINR(masterBudgetCap)}
              </strong>
            </span>
          </div>
        </div>

        {/* 2) OVERALL APPROVED SPEND VS. BUDGET SEMI-CIRCLE METER */}
        <div className="min-w-0 bg-white p-5 rounded-xl border border-sage-200 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-stone-900 truncate">
                Approved Spend vs. Budget
              </h3>
              <p className="text-[11px] text-stone-500 truncate">
                80% Orange &middot; 90% Red warning thresholds
              </p>
            </div>
            <span
              className={`text-[11px] font-medium px-2.5 py-0.5 rounded-md border shrink-0 whitespace-nowrap ${gaugeBadgeClass}`}
            >
              {gaugeStatusLabel}
            </span>
          </div>

          <div className="relative h-48 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={gaugeData}
                  dataKey="value"
                  cx="50%"
                  cy="82%"
                  startAngle={180}
                  endAngle={0}
                  innerRadius={64}
                  outerRadius={90}
                  paddingAngle={0}
                  stroke="none"
                >
                  <Cell fill={gaugeColor} />
                  <Cell fill="#e7efe9" />
                </Pie>
                <Tooltip
                  formatter={(val, name) => [`${Number(val).toFixed(1)}%`, name]}
                />
              </PieChart>
            </ResponsiveContainer>

            <div className="absolute inset-x-0 bottom-5 text-center pointer-events-none px-2">
              <p
                className="text-3xl font-bold leading-none"
                style={{ color: gaugeColor }}
              >
                {rawPct.toFixed(1)}%
              </p>
              <p className="text-xs text-stone-500 mt-1.5">
                {formatINR(approvedSpend)} / {formatINR(masterBudgetCap)}
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-sage-100 flex items-center justify-between text-[11px] text-stone-500">
            <span>Approved bills only</span>
            {inProcessSpend > 0 && (
              <span className="text-amber-700 font-medium">
                +{formatINR(inProcessSpend)} in process
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row: 3) SUB-EVENT WISE BUDGET VS. APPROVED SPEND (HORIZONTAL BAR) */}
      <div className="min-w-0 bg-white p-5 rounded-xl border border-sage-200 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-stone-900">
              Sub-Event Wise Budget vs. Approved Spend
            </h3>
            <p className="text-[11px] text-stone-500">
              Horizontal comparison per sub-event so labels stay legible at any scale
            </p>
          </div>
          <span className="text-[11px] text-stone-500">
            {subEventBarData.length} sub-event
            {subEventBarData.length === 1 ? '' : 's'}
          </span>
        </div>

        {subEventBarData.length === 0 ? (
          <div className="h-44 flex items-center justify-center text-xs text-stone-400">
            No sub-events created under {activeMaster.name} yet.
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto pr-1">
            <div
              style={{ height: `${horizontalChartHeight}px` }}
              className="w-full min-w-0"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={subEventBarData}
                  layout="vertical"
                  margin={{ top: 6, right: 20, left: 8, bottom: 6 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={false}
                    stroke="#e7efe9"
                  />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: '#78716c' }}
                    axisLine={{ stroke: '#d9e5dc' }}
                    tickLine={false}
                    tickFormatter={(v) =>
                      v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v
                    }
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={135}
                    tick={{ fontSize: 11, fill: '#44403c', fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value, name) => [formatINR(value), name]}
                    cursor={{ fill: '#f4f8f5' }}
                    contentStyle={{
                      borderRadius: '8px',
                      borderColor: '#d9e5dc',
                      fontSize: '12px',
                    }}
                  />
                  <Legend
                    iconSize={10}
                    wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }}
                  />
                  <Bar
                    dataKey="budget"
                    name="Budget Cap"
                    fill="#b8d1be"
                    radius={[0, 5, 5, 0]}
                    barSize={12}
                  />
                  <Bar
                    dataKey="spent"
                    name="Approved Spend"
                    fill="#4d7c5b"
                    radius={[0, 5, 5, 0]}
                    barSize={12}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export const ExecutiveAnalytics = MasterEventAnalytics;