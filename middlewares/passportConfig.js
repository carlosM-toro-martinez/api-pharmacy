const { ExtractJwt, Strategy: JwtStrategy } = require("passport-jwt");
const { Administrador, Trabajador, Rol, Permiso } = require("../models");
const jwtSecret = process.env.JWT_SECRET || "your_jwt_secret";

const opts = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: jwtSecret,
};

module.exports = (passport) => {
  passport.use(
    new JwtStrategy(opts, async (jwtPayload, done) => {
      try {
        let user;
        if (jwtPayload.tipo === "trabajador") {
          user = await Trabajador.findByPk(jwtPayload.id, {
            include: [
              {
                model: Rol,
                include: [{ model: Permiso }],
              },
            ],
          });
        } else if (jwtPayload.tipo === "administrador") {
          user = await Administrador.findByPk(jwtPayload.id);
        }

        if (user) {
          return done(null, user);
        } else {
          return done(null, false);
        }
      } catch (error) {
        return done(error, false);
      }
    })
  );
};
