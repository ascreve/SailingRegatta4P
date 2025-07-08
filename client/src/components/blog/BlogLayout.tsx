import { Link } from "react-router-dom";
import { Calendar, ArrowLeft, Clock } from "lucide-react";
import { Button } from "../ui/button";
import Navbar from "../layout/Navbar";

interface BlogLayoutProps {
  children: React.ReactNode;
  title?: string;
  showBackButton?: boolean;
}

export default function BlogLayout({ children, title = "GOAT Sailing Blog", showBackButton = false }: BlogLayoutProps) {
  return (
    <div className="blog-container min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50">
      <Navbar />
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <header className="mb-6 sm:mb-8">
          {showBackButton && (
            <Button 
              variant="ghost" 
              asChild 
              className="mb-3 sm:mb-4 text-blue-600 hover:text-blue-800 text-sm sm:text-base"
            >
              <Link to="/blog">
                <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                Back to Blog
              </Link>
            </Button>
          )}
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-blue-900 mb-2">{title}</h1>
          <div className="w-16 sm:w-24 h-1 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full"></div>
        </header>
        
        <main className="max-w-4xl mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}