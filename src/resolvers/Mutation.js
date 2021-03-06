const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomBytes } = require('crypto');
const { promisify } = require('util');

const Mutations = {
  async createItem(parent, args, ctx, info) {
    // TODO: Check if they are logged in

    const item = await ctx.db.mutation.createItem({
      data: { ...args } // spread operator
    }, info);

    console.log(item);

    return item;
  },

  updateItem(parent, args, ctx, info) {
    // first take a copy fo the updates
    const updates = { ...args };
    // remove id from the updates
    delete updates.id;
    // run the update method
    return ctx.db.mutation.updateItem(
      {
        data: updates,
        where: {
          id: args.id
        },
      },
      info
    );
  },
  async deleteItem(parent, args, ctx, info) {
    const where = { id: args.id };
    // 1. Find the item
    const item = await ctx.db.query.item({ where }, `{ id title}`);
    // 2. Check if they have permission to delete
    // TODO
    // 3. Delete it!
    return ctx.db.mutation.deleteItem({ where }, info);
  },
  async signup(parent, args, ctx, info) {
    args.email = args.email.toLowerCase();
    // hash their password. The 10 is the Salt value
    const password = await bcrypt.hash(args.password, 10);
    // create the User in the db
    const user = await ctx.db.mutation.createUser(
      {
        data: {
          ...args,
          password,
          permissions: { set: ['USER'] },
        }
      }, 
      info
    );
    // create the JWT for them
    const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET);
    // We set the jwt as a cookie on the response
    ctx.response.cookie('token', token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year cookie
    });
    // Finally, return the user to the browser
    return user;
  },
  async signin(parent, { email, password }, ctx, info) {
    // 1. check if there is a user with that email
    const user = await ctx.db.query.user({ where: { email } });
    if(!user) {
      throw new Error(`No such user found for email: ${email}`);
    }
    // 2. check if password is correct
    const valid = await bcrypt.compare(password, user.password);
    if(!valid) {
      throw new Error("Invalid Password!");
    }
    // 3. generate the JWT token
    const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET);
    // 4. set the cookie with the token
    ctx.response.cookie('token', token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year cookie
    });
    // 5. return the user
    return user;
  },
  signout(parent, args, ctx, info) {
    ctx.response.clearCookie('token');
    return { message: "You have been successfully signed out!" };
  },
  async requestReset(parent, args, ctx, info) {
    // 1. Check if this is a real User
    const user = await ctx.db.query.user({ where: { email: args.email } });

    if(!user) {
      throw new Error(`No such user found for email: ${args.email}`);
    }
    // 2. Set a reset token and expiry on that user
    const resetToken = (await promisify(randomBytes)(20)).toString('hex');
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour from now
    const res = await ctx.db.mutation.updateUser({
      where: { email: args.email },
      data: { resetToken, resetTokenExpiry}
    });
    console.log(res);
    return { message: "Password Reset" };
    // 3. Email them that reset token
  },
  async resetPassword(parent, args, ctx, info) {
    //1. Check if the passwords match
    if(args.password !== args.confirmPassword) {
      throw new Error("Your passwords don\'t match!");
    }
    // 2. Check if its a valid reset Token
    // 3. Check if its expired\
    const [user] = await ctx.db.query.users({
      where: {
        resetToken: args.resetToken,
        resetTokenExpiry_gte: Date.now() - 360000, // less than an hour old
      },
    });
    if(!user) {
      throw new Error("This token is either invalid or expired!");
    }
    // 4. Hash their new password
    const password = await bcrypt.hash(args.password, 10);
    // 5. Save the new password and remove old reset token fields
    const updatedUser = await ctx.db.mutation.updateUser({
      where: { email: user.email },
      data: {
        password,
        resetToken: null,
        resetTokenExpiry: null,
      },
    }); 
    // 6. Generate jwt
    const token = jwt.sign({ userId: updatedUser.id }, process.env.APP_SECRET);
    // 7. set the jwt cookie
    ctx.response.cookie('token', token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365,
    })
    // 8. Return new user
    return updatedUser;
  },
};

module.exports = Mutations;
