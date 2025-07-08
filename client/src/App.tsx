import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Suspense, lazy, useEffect } from "react";
import { Toaster } from "sonner";
import { useAuth } from "./lib/stores/useAuth";
import PrivateRoute from "./components/auth/PrivateRoute";
import Layout from "./components/layout/Layout";
import { updatePageSEO, trackPageView, addPageSchema } from "./utils/seo";

// Lazy-loaded components
const Game = lazy(() => import("./components/game/Game"));
const LoginForm = lazy(() => import("./components/auth/LoginForm"));
const RegisterForm = lazy(() => import("./components/auth/RegisterForm"));
const ForgotPassword = lazy(() => import("./components/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("./components/auth/ResetPassword"));
const ProfilePage = lazy(() => import("./components/profile/ProfilePage"));
const EditProfile = lazy(() => import("./components/profile/EditProfile"));
const Blog = lazy(() => import("./pages/blog"));
const BlogPost = lazy(() => import("./components/blog/BlogPost"));
const NotFound = lazy(() => import("./pages/not-found"));

// Loading component
const LoadingScreen = () => (
  <div className="w-full h-screen flex items-center justify-center bg-background">
    <div className="text-2xl font-bold animate-pulse">Loading...</div>
  </div>
);

function App() {
  const { checkAuth } = useAuth();
  const location = useLocation();

  // Check authentication status when app loads
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Update SEO for each page
  useEffect(() => {
    updatePageSEO(location.pathname);
    addPageSchema(location.pathname);
    trackPageView(location.pathname, document.title);
  }, [location.pathname]);

  return (
    <>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginForm />} />
          <Route path="/register" element={<RegisterForm />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          
          {/* Protected routes */}
          <Route 
            path="/" 
            element={
              <PrivateRoute>
                <Layout>
                  <Game />
                </Layout>
              </PrivateRoute>
            } 
          />
          
          <Route 
            path="/profile" 
            element={
              <PrivateRoute>
                <Layout>
                  <ProfilePage />
                </Layout>
              </PrivateRoute>
            } 
          />
          
          <Route 
            path="/profile/edit" 
            element={
              <PrivateRoute>
                <Layout>
                  <EditProfile />
                </Layout>
              </PrivateRoute>
            } 
          />
          
          {/* Blog routes */}
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:postId" element={<BlogPost />} />
          
          {/* 404 and redirects */}
          <Route path="/home" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <Toaster position="top-right" />
    </>
  );
}

export default App;
