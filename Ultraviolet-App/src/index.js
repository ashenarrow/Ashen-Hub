import { createServer } from "node:http"; 
import { join } from "node:path";
import { hostname } from "node:os";
import wisp from "wisp-server-node";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyWebsocket from "fastify-websocket";

// static paths
import { publicPath } from "ultraviolet-static";
import { uvPath } from "@titaniumnetwork-dev/ultraviolet";
import { epoxyPath } from "@mercuryworkshop/epoxy-transport";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";

const fastify = Fastify({
	serverFactory: (handler) => {
		return createServer()
			.on("request", (req, res) => {
				res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
				res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
				handler(req, res);
			})
			.on("upgrade", (req, socket, head) => {
				if (req.url.endsWith("/wisp/")) wisp.routeRequest(req, socket, head);
				else socket.end();
			});
	},
});

// Serve static files (your original static file serving remains unchanged)
fastify.register(fastifyStatic, {
	root: publicPath,
	decorateReply: true,
});
fastify.get("/uv/uv.config.js", (req, res) => {
	return res.sendFile("uv/uv.config.js", publicPath);
});
fastify.register(fastifyStatic, {
	root: uvPath,
	prefix: "/uv/",
	decorateReply: false,
});
fastify.register(fastifyStatic, {
	root: epoxyPath,
	prefix: "/epoxy/",
	decorateReply: false,
});
fastify.register(fastifyStatic, {
	root: baremuxPath,
	prefix: "/baremux/",
	decorateReply: false,
});

// ===== New API Endpoints (with /api prefix) =====

// In-memory storage for votes, users, and chat messages
let votes = {};       // { [gameName]: { likes: number, dislikes: number } }
let users = {};       // { username: { password, friends: [], votes: {} } }
let chatMessages = []; // Array of { username, text, timestamp }

// Authentication
fastify.post("/api/signup", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.code(400).send({ error: "Missing fields" });
  if (users[username]) return res.code(400).send({ error: "Username already taken" });
  users[username] = { password, friends: [], votes: {} };
  return { success: true };
});
fastify.post("/api/signin", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.code(400).send({ error: "Missing fields" });
  if (!users[username] || users[username].password !== password)
    return res.code(400).send({ error: "Invalid credentials" });
  return { success: true };
});
fastify.get("/api/profile", async (req, res) => {
  const { username } = req.query;
  if (!username || !users[username]) return res.code(400).send({ error: "Invalid username" });
  return { username, friends: users[username].friends };
});
fastify.post("/api/profile/friends", async (req, res) => {
  const { username, friend } = req.body;
  if (!username || !friend) return res.code(400).send({ error: "Missing fields" });
  if (!users[username]) return res.code(400).send({ error: "User not found" });
  if (!users[username].friends.includes(friend)) {
    users[username].friends.push(friend);
  }
  return { success: true, friends: users[username].friends };
});
fastify.delete("/api/profile/friends", async (req, res) => {
  const { username, friend } = req.body;
  if (!username || !friend) return res.code(400).send({ error: "Missing fields" });
  if (!users[username]) return res.code(400).send({ error: "User not found" });
  users[username].friends = users[username].friends.filter(f => f !== friend);
  return { success: true, friends: users[username].friends };
});

// Voting (one vote per user per game)
fastify.post("/api/vote", async (req, res) => {
  const { username, gameName, vote } = req.body;
  if (!username || !gameName || (vote !== "like" && vote !== "dislike"))
    return res.code(400).send({ error: "Invalid payload" });
  if (!users[username]) return res.code(400).send({ error: "User not found" });
  if (!users[username].votes) users[username].votes = {};
  if (users[username].votes[gameName])
    return res.code(400).send({ error: "You have already voted for this game" });
  users[username].votes[gameName] = vote;
  if (!votes[gameName]) votes[gameName] = { likes: 0, dislikes: 0 };
  if (vote === "like") votes[gameName].likes++;
  else votes[gameName].dislikes++;
  return { success: true, votes: votes[gameName] };
});
fastify.get("/api/voteinfo", async (req, res) => {
  const { gameName } = req.query;
  if (!gameName) return res.code(400).send({ error: "Missing gameName" });
  return { votes: votes[gameName] || { likes: 0, dislikes: 0 } };
});
fastify.get("/api/popular", async (req, res) => {
  const popular = Object.entries(votes).map(([gameName, data]) => {
    return { gameName, net: data.likes - data.dislikes, ...data };
  }).sort((a, b) => b.net - a.net);
  return { popular };
});

// Chat using fastify-websocket
fastify.register(fastifyWebsocket);
fastify.get("/chat", { websocket: true }, (connection, req) => {
  connection.socket.on("message", message => {
    fastify.websocketServer.clients.forEach(client => {
      if (client !== connection.socket && client.readyState === client.OPEN) {
        client.send(message);
      }
    });
    try {
      const parsed = JSON.parse(message);
      chatMessages.push(parsed);
    } catch (e) {}
  });
  connection.socket.send(JSON.stringify({ type: "history", messages: chatMessages }));
});

// ===== Original Static File and Other Configurations =====
fastify.server.on("listening", () => {
	const address = fastify.server.address();
	console.log("Listening on:");
	console.log(`\thttp://localhost:${address.port}`);
	console.log(`\thttp://${hostname()}:${address.port}`);
	console.log(
		`\thttp://${
			address.family === "IPv6" ? `[${address.address}]` : address.address
		}:${address.port}`
	);
});
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
function shutdown() {
	console.log("SIGTERM signal received: closing HTTP server");
	fastify.close();
	process.exit(0);
}
let port = parseInt(process.env.PORT || "");
if (isNaN(port)) port = 8080;
fastify.listen({ port: port, host: "0.0.0.0" });
