const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: "sandbox.smtp.mailtrap.io",
    port: 2525,
    auth: {
        user: "your_mailtrap_user", // USER: Replace with your Mailtrap user
        pass: "your_mailtrap_pass"  // USER: Replace with your Mailtrap pass
    }
});

const sendUserCredentials = async (email, username, password) => {
    const mailOptions = {
        from: '"System Admin" <admin@example.com>',
        to: email,
        subject: 'Your New Account Credentials',
        text: `Hello ${username},\n\nYour account has been created.\nUsername: ${username}\nPassword: ${password}\n\nPlease change your password after logging in.`,
        html: `<p>Hello <b>${username}</b>,</p>
               <p>Your account has been created.</p>
               <p><b>Username:</b> ${username}</p>
               <p><b>Password:</b> ${password}</p>
               <p>Please change your password after logging in.</p>`
    };

    return transporter.sendMail(mailOptions);
};

module.exports = { sendUserCredentials };
