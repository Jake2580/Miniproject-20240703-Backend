let router = require('express').Router();
const sha = require('sha256');

// BackendServer auth
// DB Setup
const { setup } = require('../utils/setup_db');

router.post('/edit', async function (req, res) {
    try {
        const { mysqldb } = await setup();
        let sql = `SELECT userid, email FROM users WHERE userid=?`;
        let [rows, fields] = await mysqldb.promise().query(sql, [req.body.userid]);

        if (rows.length == 0) {
            return res.status(400).json({ alertMsg: '회원 정보가 존재하지 않습니다.' });
        }

        // 이메일 변경 처리
        if (rows[0].email !== req.body.email) {
            sql = `UPDATE users SET email=? WHERE userid=?`;
            await mysqldb.promise().query(sql, [req.body.email, req.body.userid]);
        }

        // 비밀번호 변경 처리
        if (req.body.userpw) {
            const generateSalt = (length = 16) => {
                const crypto = require('crypto');
                return crypto.randomBytes(length).toString("hex");
            };
            const salt = generateSalt();
            req.body.userpw = sha(req.body.userpw + salt);

            sql = `UPDATE users SET userpw=?, salt=?, userpw_updated_at=NOW() WHERE userid=?`;
            await mysqldb.promise().query(sql, [req.body.userpw, salt, req.body.userid]);
        }

        req.body.alertMsg = '회원정보 변경 완료.';
        return res.json({ data: req.body });
    } catch (err) {
        console.error(err);
    }
});

// 회원 정보 전달
router.post('/edit-info', async function (req, res) {
    try {
        const { mysqldb } = await setup();
        let sql = `SELECT userid, email FROM users WHERE userid=?`;
        let [rows, fields] = await mysqldb.promise().query(sql, [req.body.userid]);

        if (rows.length == 0) {
            return res.status(401).json({ alertMsg: '회원 정보가 존재하지 않습니다.' });
        }

        return res.json({ alertMsg: false, data: rows[0] });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ alertMsg: '서버 오류가 발생했습니다.' });
    }
});

// 로그인
router.post('/login', async function (req, res) {
    const { mysqldb } = await setup();
    let sql = `SELECT userid, userpw, salt, userpw_updated_at FROM users WHERE userid=?`;
    try {
        let [rows, fields] = await mysqldb.promise().query(sql, [req.body.userid]);
        if (rows.length == 0) {
            return res.status(401).json({ alertMsg: '아이디 또는 비밀번호가 틀립니다.' });
        }

        if (rows[0].userpw != sha(req.body.userpw + rows[0].salt)) {
            return res.status(401).json({ alertMsg: '아이디 또는 비밀번호가 틀립니다.' });
        }

        const lastUpdatedDate = new Date(rows[0].userpw_updated_at);
        const currentDate = new Date();
        const threeMonthsAgo = new Date(currentDate.getTime() - (3 * 30 * 24 * 60 * 60 * 1000));
        if (lastUpdatedDate < threeMonthsAgo) {
            return res.json({ alertMsg: '비밀번호 변경이 필요합니다.', passwordChangeRequired: true });
        }

        return res.json({ alertMsg: false });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ alertMsg: '서버 오류가 발생했습니다.' });
    }
});

// 회원가입 폼에서 중복 아이디 검사
router.post('/check-id', async function (req, res) {
    try {
        if (req.body.userid == undefined) {
            return res.json({ isDuplicate: true });
        }
        
        const { mysqldb } = await setup();
        let sql = `SELECT userid FROM users WHERE userid=?`;
        let [rows, fields] = await mysqldb.promise().query(sql, [req.body.userid]);

        if (rows.length == 0) {
            return res.json({ isDuplicate: false });
        } else {
            return res.json({ isDuplicate: true });
        }
    } catch (error) {
        console.error('Error checking user ID:', error);
        res.status(500).json({ error: 'An error occurred while checking the user ID.' });
    }
});

// 회원가입 - 유저 등록
router.post('/sign-up', async function (req, res) {
    const { mysqldb } = await setup();
    let sql = `SELECT COUNT(*) as count FROM users WHERE userid=?`;
    try {
        if (req.body.userid.length < 4) {
            return res.status(400).json({ alertMsg: '아이디는 4자리 이상으로 해주세요.' });
        } // 검사: 아이디 
        
        let [rows, fields] = await mysqldb.promise().query(sql, [req.body.userid]);
        if (0 < rows[0].count) {
            return res.status(400).json({ alertMsg: '해당 아이디는 이미 존재합니다.' });
        } // 중복 아이디 체크

        if (req.body.userpw.length < 8) {
            return res.status(400).json({ alertMsg: '비밀번호는 8자리 이상으로 해주세요.' });
        } // 검사: 비밀번호

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(req.body.email)) {
            return res.status(400).json({ alertMsg: '이메일 형식이 올바르지 않습니다.' });
        } // 검사: 이메일

        // 비밀번호 암호화
        const generateSalt = (length = 16) => {
            const crypto = require('crypto');
            return crypto.randomBytes(length).toString("hex");
        }; const salt = generateSalt(); req.body.userpw = sha(req.body.userpw + salt);

        // 회원 정보 저장
        sql = `INSERT INTO users (userid, userpw, salt, email, birthday) VALUES (?, ?, ?, ?, ?)`;
        await mysqldb.promise().query(sql, [req.body.userid, req.body.userpw, salt, req.body.email, req.body.birthday]);

        // 회원가입 완료
        return res.json({ alertMsg: '가입이 완료되었습니다.' });
    } catch (err) {
        return res.status(400).json({ alertMsg: '이미 등록된 이메일입니다.' });
    }
});

module.exports = router;