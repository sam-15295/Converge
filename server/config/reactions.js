// The emoji a message can be reacted with. A fixed list, on purpose :
//   * the reaction is stored under a database field name ("reactions.👍"), and field names must never be
//     something a user can choose freely (a name with a dot or starting with $ would be dangerous);
//   * the screen needs a small palette anyway.
// The frontend has the same list for its buttons, and the server refuses anything else.
export const allowedReactions = ["👍", "❤️", "😂", "🎉", "😮", "😢", "🙏", "👀"];
