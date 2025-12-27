import { ArrowUpRight, ArrowDownRight } from "lucide-react";

interface TrendCardProps {
    title: string;
    description: string;
    percentage: string;
    isPositive: boolean;
    tagLabel: string;
}

const TrendCard = ({
    title,
    description,
    percentage,
    isPositive,
    tagLabel,
}: TrendCardProps) => {
    return (
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col h-full">
            <div className="flex justify-between items-start mb-4">
                <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                        isPositive
                            ? "bg-green-50 text-green-700"
                            : "bg-orange-50 text-orange-700"
                    }`}
                >
                    {isPositive ? (
                        <ArrowUpRight className="w-3.5 h-3.5" />
                    ) : (
                        <ArrowDownRight className="w-3.5 h-3.5" />
                    )}
                    {tagLabel}
                </span>

                <span
                    className={`text-lg font-bold ${
                        isPositive ? "text-green-600" : "text-orange-600"
                    }`}
                >
                    {percentage}
                </span>
            </div>

            <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
            <p className="text-gray-500 text-sm leading-relaxed">{description}</p>
        </div>
    );
};

export default TrendCard;
