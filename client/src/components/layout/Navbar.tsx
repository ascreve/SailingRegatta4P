import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/stores/useAuth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, LogOut, Menu, Info, MessageSquare, ShoppingBag, BookOpen, X } from "lucide-react";
import { useState } from "react";
import FeedbackDialog from "@/components/feedback/FeedbackDialog";

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <>
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between px-4">
          <div className="flex">
            <Link to="/" className="flex items-center justify-center">
              <img 
                src="/images/goat-sailing-logo.png" 
                alt="GOAT Sailing Race Logo" 
                className="h-8 w-auto mr-2"
              />
              <span className="font-bold text-sm sm:text-base">GOAT Sailing Race</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              asChild
            >
              <Link to="/blog">
                Blog
              </Link>
            </Button>
            
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => window.open("https://www.goatsailing.org/", "_blank")}
            >
              Merch
            </Button>
            
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => window.open("https://www.linkedin.com/in/antoinescreve/", "_blank")}
            >
              About
            </Button>
            
            {isAuthenticated && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowFeedbackDialog(true)}
              >
                Have feedback?
              </Button>
            )}
            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <User className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" forceMount className="bg-white dark:bg-gray-950">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user?.username}</p>
                      <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/profile">
                      <User className="mr-2 h-4 w-4" />
                      <span>Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/login">Sign In</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link to="/register">Register</Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t bg-background">
            <div className="flex flex-col p-4 space-y-2">
              <Button 
                variant="ghost" 
                size="sm" 
                asChild
                className="justify-start"
              >
                <Link to="/blog" onClick={() => setMobileMenuOpen(false)}>
                  <BookOpen className="mr-2 h-4 w-4" />
                  Blog
                </Link>
              </Button>
              
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  window.open("https://www.goatsailing.org/", "_blank");
                  setMobileMenuOpen(false);
                }}
                className="justify-start"
              >
                <ShoppingBag className="mr-2 h-4 w-4" />
                Merch
              </Button>
              
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  window.open("https://www.linkedin.com/in/antoinescreve/", "_blank");
                  setMobileMenuOpen(false);
                }}
                className="justify-start"
              >
                <Info className="mr-2 h-4 w-4" />
                About
              </Button>
              
              {isAuthenticated && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setShowFeedbackDialog(true);
                    setMobileMenuOpen(false);
                  }}
                  className="justify-start"
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Have feedback?
                </Button>
              )}

              {isAuthenticated ? (
                <>
                  <div className="border-t pt-2 mt-2">
                    <div className="px-3 py-2">
                      <p className="text-sm font-medium">{user?.username}</p>
                      <p className="text-xs text-muted-foreground">{user?.email}</p>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    asChild
                    className="justify-start"
                  >
                    <Link to="/profile" onClick={() => setMobileMenuOpen(false)}>
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </Link>
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      handleLogout();
                      setMobileMenuOpen(false);
                    }}
                    className="justify-start"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </Button>
                </>
              ) : (
                <>
                  <div className="border-t pt-2 mt-2"></div>
                  <Button variant="ghost" size="sm" asChild className="justify-start">
                    <Link to="/login" onClick={() => setMobileMenuOpen(false)}>Sign In</Link>
                  </Button>
                  <Button size="sm" asChild className="justify-start">
                    <Link to="/register" onClick={() => setMobileMenuOpen(false)}>Register</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </nav>
      
      <FeedbackDialog 
        isOpen={showFeedbackDialog} 
        onClose={() => setShowFeedbackDialog(false)} 
      />
    </>
  );
}