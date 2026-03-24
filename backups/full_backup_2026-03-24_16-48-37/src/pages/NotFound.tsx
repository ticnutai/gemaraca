import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
        <p className="text-xl text-muted-foreground">העמוד המבוקש לא נמצא</p>
        <a href="/" className="inline-block rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90">
          חזרה לדף הראשי
        </a>
      </div>
    </div>
  );
};

export default NotFound;
