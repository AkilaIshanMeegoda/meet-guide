import { ThumbsUp, ThumbsDown, CheckCircle, AlertCircle } from "lucide-react";

interface HighlightItem {
    title: string;
    description: string;
}

interface HighlightCardProps {
    type: "positive" | "negative";
    title: string;
    items: HighlightItem[];
}

const HighlightCard = ({ type, title, items }: HighlightCardProps) => {
    const isPositive = type === "positive";

    const HeaderIcon = isPositive ? ThumbsUp : ThumbsDown;
    const ItemIcon = isPositive ? CheckCircle : AlertCircle;

    // Exact colors from the screenshot
    const headerIconBg = isPositive ? "bg-indigo-50" : "bg-red-50";
    const headerIconColor = isPositive ? "text-indigo-600" : "text-red-500";
    const itemIconColor = isPositive ? "text-indigo-600" : "text-red-500";

    return (
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm h-full ring-2 ring-indigo-50/50">
            <div className="flex items-center gap-4 mb-8">
                <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center ${headerIconBg} ${headerIconColor}`}
                >
                    <HeaderIcon className="w-6 h-6 fill-current" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">{title}</h3>
            </div>

            <div className="space-y-6">
                {items.map((item, index) => (
                    <div key={index} className="flex gap-4 items-start">
                        <div className="mt-1 flex-shrink-0">
                            <ItemIcon className={`w-5 h-5 ${itemIconColor}`} />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-gray-900 mb-1">
                                {item.title}
                            </h4>
                            <p className="text-sm text-gray-500 leading-relaxed">
                                {item.description}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default HighlightCard;
