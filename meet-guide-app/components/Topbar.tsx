import Image from "next/image";

const Topbar = () => {
    return (
        <div className="h-16 w-full bg-white border-b border-gray-200 flex items-center justify-end px-8">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-200">
                    {/* Placeholder for user image, using a generic avatar if no asset available */}
                    <div className="w-full h-full bg-gray-300 flex items-center justify-center text-gray-600 font-bold">
                        U
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Topbar;
