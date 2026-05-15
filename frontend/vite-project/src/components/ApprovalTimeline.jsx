import { CheckCircle, Circle, XCircle } from "lucide-react";

const STAGES = ["Event Head", "Faculty", "Storekeeper", "Principal"];

export default function ApprovalTimeline({ currentStatus }) {
  // currentStatus could be "Faculty" or "REJECTED"
  
  return (
    <div className="flex items-center justify-between w-full mb-12 bg-white p-6 rounded-xl shadow-sm">
      {STAGES.map((stage, index) => {
        const isCompleted = index < STAGES.indexOf(currentStatus);
        const isCurrent = stage === currentStatus;
        const isRejected = currentStatus === "REJECTED";

        return (
          <div key={stage} className="flex flex-col items-center flex-1 relative">
            {/* The Line */}
            {index !== 0 && (
              <div className={`absolute right-1/2 w-full h-1 top-5 -z-10 ${isCompleted ? 'bg-green-500' : 'bg-gray-200'}`} />
            )}
            
            {/* The Icon */}
            <div className="bg-white p-1">
              {isCompleted ? (
                <CheckCircle className="text-green-500 w-10 h-10" />
              ) : isCurrent ? (
                isRejected ? <XCircle className="text-red-500 w-10 h-10 animate-pulse" /> : <Circle className="text-blue-500 w-10 h-10 fill-blue-50" />
              ) : (
                <Circle className="text-gray-300 w-10 h-10" />
              )}
            </div>
            
            <span className={`mt-2 text-sm font-medium ${isCurrent ? 'text-blue-600' : 'text-gray-500'}`}>
              {stage}
            </span>
          </div>
        );
      })}
    </div>
  );
}