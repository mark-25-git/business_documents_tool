import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md w-full text-center space-y-8">
        <h1 className="text-4xl font-bold text-gray-900 tracking-tight">Megah Invoice Tool</h1>
        <p className="text-gray-500">Create professional business documents in seconds.</p>
        
        <div className="grid gap-4">
          <Link 
            href="/documents/new-simple" 
            className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md font-medium transition-colors"
          >
            Create New Document (Simple)
          </Link>
          
          <Link 
            href="/documents/new" 
            className="w-full py-4 px-6 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg shadow-sm font-medium transition-colors"
          >
            Create New Document (Advanced)
          </Link>
          
          <Link 
            href="/documents" 
            className="w-full py-4 px-6 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg shadow-sm font-medium transition-colors"
          >
            View History
          </Link>
          
           <Link 
            href="/customers" 
            className="w-full py-4 px-6 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg shadow-sm font-medium transition-colors"
          >
            Manage Customers
          </Link>
        </div>
      </div>
    </main>
  );
}



