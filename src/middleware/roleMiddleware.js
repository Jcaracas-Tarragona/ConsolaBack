// src/middlewares/roleMiddleware.js
export function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      console.log(req.user);
      
      return res.status(403).json({ error: "Acceso no autorizado" });
    }
    next();
  };
}
