
const nodemailer = require('nodemailer');


const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'justmymail321123@gmail.com',
        pass: 'kiet@1234'
    }
});

const sendMail = (email, subject, text) => {
    const mailOptions = {
        from: 'justmymail321123@gmail.com',
        to: email,
        subject: subject,
        text: text
    };
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Error sending email:', error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });
};

module.exports = sendMail;