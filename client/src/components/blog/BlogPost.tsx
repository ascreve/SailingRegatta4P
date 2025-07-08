import { useParams } from "react-router-dom";
import { Calendar, Clock, User, Tag } from "lucide-react";
import { Badge } from "../ui/badge";
import BlogLayout from "./BlogLayout";

interface BlogPostData {
  id: string;
  title: string;
  content: string;
  date: string;
  readTime: string;
  author: string;
  category: string;
  image?: string;
}

const blogPosts: Record<string, BlogPostData> = {
  "ai-hackathon-sailing-game": {
    id: "ai-hackathon-sailing-game",
    title: "How an AI Hackathon Sailing Game Turned Into Paying Customers",
    content: `I had no business making a video game. But I did have a weekend, too much caffeine, and a deeply held belief that the world still needed a regatta simulator after the tragic death of sailx.com. Shoutout to Chad Lohrli at SDx for building the SD tech community and the invite to the Replit hackathon.

No plan, no business model, just pure vibe coding and an unhealthy knowledge of wind shifts.

*Read the original LinkedIn post about this journey: [https://www.linkedin.com/posts/antoinescreve_vibe-coding-how-an-ai-hackathon-sailing-activity-7336074432450351104-0MjI](https://www.linkedin.com/posts/antoinescreve_vibe-coding-how-an-ai-hackathon-sailing-activity-7336074432450351104-0MjI?utm_source=share&utm_medium=member_desktop&rcm=ACoAAAyYzlQBA2sBwT6gL6JikJ_nZuQlavX7qJY)*

Last Friday I hosted our first paid tournament: 12 sailors packed into a yacht club classroom, laughing, yelling, and blaming game bugs for their performance.

## Tournament Highlights

The energy was incredible. Here's what made it special:

- **One of the sailors, Kevin, went live on Instagram during the tournament** - Nothing says legitimacy like organic social media coverage from your players
- **The game randomly restarted races several times.** I blamed it on the AI deciding to abandon a race. Yes this really happens in sailboat racing.
- **Two of the sailors made GOAT sailing shirts for prizes** - When your community starts making merch, you know you're onto something
- **3 parents participated and got shown up by the kids** - Proof that good sailing tactics translate across generations

## The Real Story Behind GOAT Sailing

This was never meant to be a startup. I built it because I coach 29ers at [SDYC](https://www.sdyc.org/), and sometimes there's no wind. Do I make the kids run laps or do pushups? Or let them sharpen tactics in a chaotic digital throwdown?

The answer became obvious after our first tournament. This isn't just a game - it's a training tool that happens to be incredibly fun.

## Key Takeaways for Builders

If you want your project to hit, here's what I learned:

### 1. Build for a group you already hang out with
If you know them well, building the right thing and getting early users becomes so much easier. I didn't have to guess what sailors wanted - I am one.

### 2. Surround yourself with people that energize you when building
Hackathon is one option, but find your tribe. The energy you get from being around other builders is rocket fuel for creativity.

### 3. Force fake deadlines on yourself with a group of peers
Social accountability is a strong motivator. It accelerates execution in ways you can't imagine until you experience it.

### 4. Don't focus on making the product perfect or look amazing
Focus on meeting the ICP's "job to be done". My game will never rival GTA 6. It's 2D, the boats look like watermelon seeds. But it solves a real problem for sailing coaches and competitive sailors.

### 5. TAM and VC funding can sometimes be overrated
The sailboat racing market is tiny but it's one I know well. Sometimes a small, passionate community is better than a massive, indifferent one.

## The Philosophy

Not everything has to scale. Sometimes it just needs to vibe.

GOAT Sailing started as weekend project and became something that brings real value to a community I care about. That's enough for me.

---

*Read the original LinkedIn post about this journey [here](https://www.linkedin.com/posts/antoinescreve_vibe-coding-how-an-ai-hackathon-sailing-activity-7336074432450351104-0MjI?utm_source=share&utm_medium=member_desktop&rcm=ACoAAAyYzlQBA2sBwT6gL6JikJ_nZuQlavX7qJY).*

*Want to experience tactical sailing without getting wet? Try GOAT Sailing Race and join our growing community of digital sailors mastering the art of wind and tactics.*`,
    date: "2025-06-13",
    readTime: "5 min read",
    author: "GOAT Sailing Team",
    category: "Story",
    image: "/blog/images/tournament-photo.jpg"
  }
};

export default function BlogPost() {
  const { postId } = useParams<{ postId: string }>();
  
  if (!postId || !blogPosts[postId]) {
    return (
      <BlogLayout title="Post Not Found" showBackButton>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Blog Post Not Found</h2>
          <p className="text-gray-600">The blog post you're looking for doesn't exist or has been moved.</p>
        </div>
      </BlogLayout>
    );
  }

  const post = blogPosts[postId];

  return (
    <BlogLayout title={post.title} showBackButton>
      <article className="bg-white rounded-lg shadow-sm overflow-hidden max-h-screen overflow-y-auto">
        {post.image && (
          <div className="w-full h-64 md:h-80 overflow-hidden">
            <img 
              src={post.image} 
              alt={post.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        
        <div className="p-4 sm:p-6 lg:p-8">
          <header className="mb-6 sm:mb-8">
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500 mb-4">
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                <Tag className="w-3 h-3 mr-1" />
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
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                {post.readTime}
              </div>
              <div className="flex items-center gap-1">
                <User className="w-3 h-3 sm:w-4 sm:h-4" />
                {post.author}
              </div>
            </div>
            
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight font-heading">
              {post.title}
            </h1>
          </header>

          <div className="prose prose-lg max-w-none">
            {post.content.split('\n\n').map((paragraph, index) => {
              if (paragraph.startsWith('## ')) {
                return (
                  <h2 key={index} className="text-2xl font-bold text-gray-900 mt-8 mb-4">
                    {paragraph.replace('## ', '')}
                  </h2>
                );
              }
              
              if (paragraph.startsWith('### ')) {
                return (
                  <h3 key={index} className="text-xl font-semibold text-gray-800 mt-6 mb-3">
                    {paragraph.replace('### ', '')}
                  </h3>
                );
              }

              if (paragraph.startsWith('- **') && paragraph.includes('**')) {
                return (
                  <div key={index} className="my-4">
                    {paragraph.split('- **').slice(1).map((item, itemIndex) => {
                      const [bold, rest] = item.split('** - ');
                      return (
                        <div key={itemIndex} className="mb-3">
                          <strong className="text-gray-900">{bold}</strong>
                          {rest && <span className="text-gray-700"> - {rest}</span>}
                        </div>
                      );
                    })}
                  </div>
                );
              }

              if (paragraph.startsWith('---')) {
                return <hr key={index} className="my-8 border-gray-200" />;
              }

              if (paragraph.startsWith('*') && paragraph.endsWith('*')) {
                // Handle LinkedIn button specially
                const content = paragraph.slice(1, -1);
                
                // Check if this contains the LinkedIn URL
                if (content.includes('linkedin.com/posts/antoinescreve')) {
                  const linkedinUrl = 'https://www.linkedin.com/posts/antoinescreve_vibe-coding-how-an-ai-hackathon-sailing-activity-7336074432450351104-0MjI?utm_source=share&utm_medium=member_desktop&rcm=ACoAAAyYzlQBA2sBwT6gL6JikJ_nZuQlavX7qJY';
                  
                  return (
                    <div key={index} className="text-gray-600 italic text-center py-4 border-l-4 border-blue-200 pl-4 bg-blue-50 rounded-r-lg">
                      <span>Read the original LinkedIn post about this journey: </span>
                      <button
                        onClick={() => {
                          window.open(linkedinUrl, '_blank', 'noopener,noreferrer');
                        }}
                        className="inline-flex items-center px-4 py-2 mx-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200"
                      >
                        View LinkedIn Post
                      </button>
                    </div>
                  );
                }

                // Parse other markdown links in italic text
                const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
                const parts = [];
                let lastIndex = 0;
                let match;

                while ((match = linkRegex.exec(content)) !== null) {
                  // Add text before the link
                  if (match.index > lastIndex) {
                    parts.push(content.slice(lastIndex, match.index));
                  }
                  // Add the link
                  parts.push(
                    <a 
                      key={match.index}
                      href={match[2]} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      {match[1]}
                    </a>
                  );
                  lastIndex = match.index + match[0].length;
                }
                
                // Add remaining text
                if (lastIndex < content.length) {
                  parts.push(content.slice(lastIndex));
                }

                return (
                  <div key={index} className="text-gray-600 italic text-center py-4 border-l-4 border-blue-200 pl-4 bg-blue-50 rounded-r-lg">
                    {parts}
                  </div>
                );
              }

              // Parse markdown links in regular paragraphs
              const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
              const parts = [];
              let lastIndex = 0;
              let match;

              while ((match = linkRegex.exec(paragraph)) !== null) {
                // Add text before the link
                if (match.index > lastIndex) {
                  parts.push(paragraph.slice(lastIndex, match.index));
                }
                // Add the link
                parts.push(
                  <a 
                    key={match.index}
                    href={match[2]} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    {match[1]}
                  </a>
                );
                lastIndex = match.index + match[0].length;
              }
              
              // Add remaining text
              if (lastIndex < paragraph.length) {
                parts.push(paragraph.slice(lastIndex));
              }

              return (
                <p key={index} className="text-gray-700 leading-relaxed mb-4">
                  {parts.length > 0 ? parts : paragraph}
                </p>
              );
            })}
          </div>
        </div>
      </article>
    </BlogLayout>
  );
}