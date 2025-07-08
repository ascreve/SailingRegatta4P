import { Link } from "react-router-dom";
import { Calendar, Clock, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Badge } from "../ui/badge";

interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
  author: string;
  category: string;
  image?: string;
}

const blogPosts: BlogPost[] = [
  {
    id: "ai-hackathon-sailing-game",
    title: "How an AI Hackathon Sailing Game Turned Into Paying Customers",
    excerpt: "I had no business making a video game. But I did have a weekend, too much caffeine, and a deeply held belief that the world still needed a regatta simulator after the tragic death of sailx.com.",
    date: "2025-06-13",
    readTime: "5 min read",
    author: "GOAT Sailing Team",
    category: "Story",
    image: "/blog/images/tournament-photo.jpg"
  }
];

export default function BlogList() {
  return (
    <div className="space-y-8">
      <div className="text-center mb-12">
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Stories from the water, insights from the code, and updates from the GOAT Sailing community.
        </p>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:gap-8 md:grid-cols-2 lg:grid-cols-1">
        {blogPosts.map((post) => (
          <Card key={post.id} className="overflow-hidden hover:shadow-lg transition-shadow group">
            <div className="lg:flex">
              {post.image && (
                <div className="lg:w-1/3">
                  <img 
                    src={post.image} 
                    alt={post.title}
                    className="w-full h-48 sm:h-56 lg:h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              )}
              <div className={post.image ? "lg:w-2/3" : "w-full"}>
                <CardHeader className="pb-3 sm:pb-4 p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500 mb-3">
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700 w-fit">
                      {post.category}
                    </Badge>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span className="hidden sm:inline">
                        {new Date(post.date).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </span>
                      <span className="sm:hidden">
                        {new Date(post.date).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                      {post.readTime}
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                    <Link to={`/blog/${post.id}`}>
                      {post.title}
                    </Link>
                  </h2>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 mb-4 line-clamp-3">
                    {post.excerpt}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">By {post.author}</span>
                    <Link 
                      to={`/blog/${post.id}`}
                      className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium group"
                    >
                      Read more
                      <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                </CardContent>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {blogPosts.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No blog posts yet. Check back soon for updates!</p>
        </div>
      )}
    </div>
  );
}