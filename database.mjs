import { Sequelize, DataTypes, BLOB } from "sequelize";
import bcrypt from "bcrypt";

/**
 * 
 * @returns {Promise<Sequelize>}
 */
export async function loadSequelize() {
    try {

        const login = {
            database: "app-database",
            username: "root",
            password: "root"
        };
        const sequelize = new Sequelize(login.database, login.username, login.password, {
            host: '127.0.0.1',
            dialect: 'mysql'
        });

        // créer les tables
        const User = sequelize.define("User", {
            username: DataTypes.STRING,
            email: DataTypes.STRING,
            password: {
                type: DataTypes.STRING, 
                set(clearPassword) {
                    const hashedPassword = bcrypt.hashSync(clearPassword, 10);
                    this.setDataValue('password', hashedPassword);
                }
            },
            role: {
                type:DataTypes.ENUM('user', 'admin'),
                defaultValue: 'user'
            }
        });

        const Post = sequelize.define("Post", {
            title: DataTypes.TEXT,
            content: DataTypes.TEXT
        });

        const Comment = sequelize.define("Comment", {
            content: DataTypes.TEXT,
        })

        User.hasMany(Post);
        Post.belongsTo(User);
        Post.hasMany(Comment);
        User.hasMany(Comment);
        Comment.belongsTo(User);
        Comment.belongsTo(Post);

        await sequelize.sync({ force: true });
        const user1 = await User.create({
            username: "John",
            email: "John@mail.com",
            password: "J123"
        });

        const user2 = await User.create({
            username: "Benoit",
            email: "BB@mail.com",
            password: "BB12"
        });

        const admin = await User.create({
            username: "admin",
            email: "admin@mail.com",
            password: "admin",
            role:'admin'
        });

        const post1 = await user1.createPost({ title: "Comment faire des oeufs aux plats ?", content: "Whaouuu trop facile" });
        const post2 = await user1.createPost({ title: "Apprendre le japonais en cuisinant", content: "vous pouvez donner vos recettes qui seront traduites" });
        const post3 = await user1.createPost({ title: "comment faire un site web ?", content: "vous pouvez utiliser JS" });

        const post4 = await user2.createPost({ title: "Je vends des chaussons aux enchères", content: "vous pouvez poster vos offres" });
        const post5 = await user2.createPost({ title: "le film Dune de denis Villeneuve", content: "j'ai adoré et je suis impatiente de voir le 3ème volet" });

        await post1.createComment({ content: "j'ai essayé, c'est super" ,UserId:admin.id});
        const com = await post2.createComment({content: "j'adore les sushis !"});
        await com.setUser(admin);
        await post4.createComment({ content: "je propose 50 centimes" });
        await post5.createComment({ content: "oui j'ai vu le premier film et je n'ai aps aimé" });




        return sequelize;
    } catch (error) {
        console.error(error);
        throw Error("Échec du chargement de Sequelize");
    }

    // ...

}