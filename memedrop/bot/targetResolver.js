async function resolveTargetUserId(targetStr, userLinks, fetchUser) {
  let targetUserId = targetStr;
  let targetUsername = targetUserId;
  
  if (targetStr.startsWith("@")) targetUserId = targetStr.substring(1);

  for (const [uid, link] of userLinks) {
    if (uid === targetUserId) {
      targetUserId = uid;
      break;
    }
    // Correct implementation: fetch the connected user by their UID, then check if their username matches
    try {
      const u = await fetchUser(uid);
      if (u && (u.username.toLowerCase() === targetUserId.toLowerCase() || u.globalName?.toLowerCase() === targetUserId.toLowerCase())) {
        targetUserId = uid;
        targetUsername = u.username;
        break;
      }
    } catch {}
  }
  
  return { targetUserId, targetUsername };
}

module.exports = { resolveTargetUserId };
