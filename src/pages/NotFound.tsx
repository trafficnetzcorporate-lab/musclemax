import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-dvh min-w-0 flex items-center justify-center bg-background p-6 [overflow-wrap:anywhere]">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-4xl font-bold tracking-tight text-primary mb-4">404</h1>
        <p className="text-xl leading-snug text-foreground mb-6">Oops! Page not found</p>
        <Button asChild className="h-auto min-h-11 max-w-full py-3">
          <Link to="/">Return to Muscle Max</Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
