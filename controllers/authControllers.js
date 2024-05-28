const UserSQL = require('../models/authModel');
const jwt = require('jsonwebtoken');

const maxAge = 3 * 24 * 60 * 60;
const createToken = (id) => {
  return jwt.sign({ id }, 'Anurags_Secret', {
    expiresIn: maxAge,
  });
};

const handleErrors = (err) => {
  let errors = { email: '', password: '', username: '', firstName: '', lastName: '', dob: '' };

  console.log(err);
  if (err.message === 'That email is not registered') {
    errors.email = 'That email is not registered';
  }

  if (err.message === 'That password is incorrect') {
    errors.password = 'That password is incorrect';
  }

  if (err.message === 'User not found') {
    errors.username = 'That username is not registered';
  }

  if (err.code === 'ER_DUP_ENTRY') {
    errors.email = 'Email is already registered';
    return errors;
  }

  if (err.message.includes('Users validation failed')) {
    Object.values(err.errors).forEach(({ properties }) => {
      errors[properties.path] = properties.message;
    });
  }

  return errors;
};

module.exports.register = async (req, res) => {
  try {
    const { email, password, username, firstName, lastName, dob, mobileNumber } = req.body;
    const newUser = {
      email,
      password,
      username,
      firstName,
      lastName,
      dob,
      mobileNumber,
    };

    const userId = await UserSQL.createUser(newUser);
    const token = createToken(userId);

    res.cookie('jwt', token, {
      httpOnly: false,
      maxAge: maxAge * 1000,
    });

    res.status(201).json({ user: userId, created: true });
  } catch (err) {
    console.error(err);
    const errors = handleErrors(err);
    res.json({ errors, created: false });
  }
};

module.exports.login = async (req, res) => {
  const { identifier, password } = req.body;

  try {
    const user = await UserSQL.getUserByEmailOrUsername(identifier);
    if (!user) {
      throw Error('User not found');
    }

    const match = await UserSQL.comparePasswords(password, user.password);
    if (!match) {
      throw Error('That password is incorrect');
    }

    const token = createToken(user.id);
    res.cookie('jwt', token, { httpOnly: false, maxAge: maxAge * 1000 });
    res.status(200).json({ user: user.id, status: true });
  } catch (err) {
    console.error(err);
    const errors = handleErrors(err);
    res.json({ errors, status: false });
  }
};

module.exports.getUserById = async (req, res) => {
  try {
    const user = await UserSQL.getUserById(req.params.userId);
    res.json({ user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
