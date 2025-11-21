import { loadSequelize } from "./database.mjs";
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import bcrypt from "bcrypt";

/**
 * Point d'entrée de l'application
 * Vous déclarer ici les routes de votre API REST
 */
async function main() {
    try {
        const { sequelize, models } = await loadSequelize();
        const { User, Post, Comment } = models; // models est un attribut de sequelize :)

        const app = express();
        app.use(cors());
        app.use(express.json());
        app.use(cookieParser());

        app.get("/users", async (req, res) => {
            try {
                const users = await User.findAll();
                res.json(users);
            } catch (err) {
                res.status(500).send("Erreur lors de la récupération des utilisateurs");
            }
        });

        app.get("/date", (req, res) => {
            res.send(new Date().toISOString());
        });

        const JWT_SECRET = 'Massiestnotreprof'; // Utilisez une clé secrète sécurisée dans une application réelle
        app.post('/login', async (req, res) => {
            const { email, password } = req.body;
            if (!email || !password) {
                return res.status(401).json({ message: 'Missing email or password' });
            }

            const user = await User.findOne({ where: { email } });
            if (!user) {
                return res.status(401).json({ message: 'Invalid email or password' });
            }

            const isPasswordTheSame = bcrypt.compareSync(password, user.password);
            if (!isPasswordTheSame) {
                return res.status(401).json({ message: 'Invalid email or password' });
            }
            // 4. Générer un token JWT lors de la connexion
            const token = jwt.sign(
                { userid: user.id },
                JWT_SECRET,
                { expiresIn: '1h' }
            );
            // 5. Envoyer le token dans un cookie HttpOnly
            res.cookie("token", token, { httpOnly: true });

            res.json({ message: "Connexion réussie" });
        });

        app.post('/logout', async (req, res) => {
            res.clearCookie('token');
            res.json({ message: 'logout successful' });
        });
        app.get("/profile/:userid", async (request, response) => {
            // Récupérer le profil de l'utilisateur connecté
            try {
                const { userid } = request.params;
                const user = await User.findByPk(userid);
                if (!user) {
                    return res.status(404).json({ error: "Utilisateur non trouvé" });
                }
                response.json(user);
            } catch (error) {
                console.error("Erreur lors de la récupération du profil :", error);
                response.status(500).json({ error: "Erreur serveur" });
            }
        });
        //Middleware d'authentification JWT
        function isLoggedInJWT(UserModel) {
            return async (req, res, next) => {
                //1- Token existe
                const token = req.cookies.token;
                if (!token) {
                    return res.status(401).json({ message: 'Unauthorized: No token provided' });
                }
                try {
                    //2- Token valide
                    const decoded = jwt.verify(token, JWT_SECRET);
                    req.userId = decoded.userid;

                    // Récupérer l'utilisateur connecté
                    req.user = await UserModel.findByPk(req.userId);
                    if (!req.user) {
                        return res.status(401).json({ message: 'Unauthorized' });
                    }

                    //3- Token décodé
                    // const payload = jwt.decode(token);
                    // const userId = payload.userId;

                    next();
                }
                catch (error) {
                    return res.status(401).json({ message: 'Unauthorized: Invalid token' });
                }
            }
        }

        app.post('/register', async (req, res) => {
            const { email, password, verifiedPassword } = req.body;

            if (!email || !password || !verifiedPassword) {
                return res.status(400).json({ message: 'Email, password and verifiedPassword are required' });
            }

            if (password !== verifiedPassword) {
                return res.status(400).json({ message: 'Passwords do not match' });
            }

            try {
                const newUser = await User.create({ email, password });
                res.status(201).json({ message: 'User registered successfully', userId: newUser.id });
            } catch (error) {
                res.status(500).json({ message: 'Error registering user', error: error.message });
            }
        });


        // Liste de tous les posts et comments
        app.get("/posts", isLoggedInJWT(User), async (req, res) => {
            try {
                const posts = await Post.findAll({ include: Comment });
                res.json({ posts });
            } catch (err) {
                res.status(500).send("Erreur lors de la récupération des posts");
            }
        });



        // Route pour créer un post
        app.post("/post", isLoggedInJWT(User), async (req, res) => {
            const { title, content } = req.body; // Extraire title et content du corps de la requête

            try {
                // Créer le nouveau post en associant l'utilisateur à celui-ci
                const newPost = await Post.create({ title, content, UserId: req.userId }); // Assurez-vous d'inclure l'ID de l'utilisateur
                res.status(201).json(newPost); // Envoyer le nouveau post en réponse avec un statut 201
            } catch (error) {
                console.error(error);
                res.status(500).json({ message: "Erreur lors de la création du post" }); // Gérer l'erreur
            }
        });

        // commenter un post
        app.post("/comment/:postId", isLoggedInJWT(User), async (req, res) => {
            const { content } = req.body; // Récupérer le contenu du commentaire
            const { postId } = req.params; // Récupérer l'ID du post à partir des paramètres de l'URL

            try {
                const newComment = await Comment.create({
                    content,
                    PostId: postId, // Utiliser l'ID du post récupéré
                    UserId: req.userId // Assurez-vous d'associer le commentaire à l'utilisateur authentifié
                });
                res.status(201).json(newComment); // Envoyer le nouveau commentaire
            } catch (error) {
                console.error(error);
                res.status(500).json({ message: "Erreur lors de la création du commentaire" }); // Gérer l'erreur
            }
        });

        // Route pour supprimer un post
        app.delete("/post/:postId", isLoggedInJWT(User), async (req, res) => {
            const { postId } = req.params;

            try {
                const post = await Post.findByPk(postId);
                if (!post) {
                    return res.status(404).json({ message: "Post non trouvé" });
                }
                // Vérification des droits
                if (req.user.role === 'admin' || post.UserId === req.userId) {
                    await post.destroy();
                    return res.status(204).send("Le post est supprimé");
                } else {
                    return res.status(403).json({ message: "Accès refusé" });
                }
            } catch (error) {
                console.error(error);
                res.status(500).json({ message: "Erreur lors de la suppression du post" });
            }
        });

        // Route pour supprimer un comment
        app.delete("/comment/:postId", isLoggedInJWT(User), async (req, res) => {
            try {
                const { postId } = req.params;
                const comment = await Comment.findByPk(postId);
                if (!comment) {
                    return res.status(404).json({ message: "Commentaire non trouvé" });
                }

                // Vérification des droits
                if (req.user.role === 'admin' || comment.UserId === req.userId) {
                    await comment.destroy();
                    return res.status(204).send("le commentaire est supprimé");
                } else {
                    return res.status(403).json({ message: "Accès refusé" });
                }
            } catch (error) {
                console.error(error);
                res.status(500).json({ message: "Erreur lors de la suppression du commentaire" });
            }
        });






        app.listen(3000, () => {
            console.log("Serveur démarré sur http://localhost:3000");
        });


    } catch (error) {
        console.error("Error de chargement de Sequelize:", error);
    }
}
main();