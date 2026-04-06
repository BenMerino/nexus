module.exports = async function handler(req, res) {
  res.setHeader("Set-Cookie", [
    "nexus_user=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
    "nexus_logged_in=; Path=/; SameSite=Lax; Max-Age=0",
  ]);
  res.writeHead(302, { Location: "/login.html" });
  res.end();
};
