import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "../components/ui/button";
import BlogLayout from "../components/blog/BlogLayout";
import BlogList from "../components/blog/BlogList";

export default function Blog() {
  return (
    <BlogLayout>
      <div className="mb-6">
        <Button 
          variant="ghost" 
          asChild 
          className="text-blue-600 hover:text-blue-800"
        >
          <Link to="/">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Game
          </Link>
        </Button>
      </div>
      <BlogList />
    </BlogLayout>
  );
}