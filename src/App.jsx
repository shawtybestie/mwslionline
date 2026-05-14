import { useState, useEffect } from "react";
import { ArrowLeft, FileText, EyeOff, Trophy, Plus } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

// ==========================================
// НАСТРОЙКА SUPABASE ДЛЯ ДИПЛОМА
// ==========================================
const SUPABASE_URL = ""; 
const SUPABASE_ANON_KEY = ""; 

const isSupabaseConfigured = SUPABASE_URL.trim() !== "" && !SUPABASE_URL.includes("ВСТАВЬТЕ");
const supabase = isSupabaseConfigured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

export default function App() {
  const [screen, setScreen] = useState("welcome");
  const [isRegistering, setIsRegistering] = useState(false);
  const [authForm, setAuthForm] = useState({ username: "", email: "", password: "" });
  const [activeCategory, setActiveCategory] = useState("Популярное");
  const [popularSubCategory, setPopularSubCategory] = useState("Бред");
  const [newPost, setNewPost] = useState("");
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [newTopicName, setNewTopicName] = useState("");
  const [customTopics, setCustomTopics] = useState([]);
  const [posts, setPosts] = useState([]);

  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("df_user");
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const getUserRankInfo = (count) => {
    if (count >= 20) return { avatar: "💀", label: "Загадка", isSmoking: true, nextText: "Высшая ступень достигнута" };
    if (count >= 10) return { avatar: "🖤", label: "Колонна", isSmoking: false, nextText: "Ступень скрыта" };
    return { avatar: "🎭", label: "Меланхолик", isSmoking: false, nextText: `До Колонны: ${10 - count}` };
  };

  const userRank = getUserRankInfo(user?.msgCount || 0);
  const isSectionLocked = activeCategory === "Прижился" && (user?.msgCount || 0) < 10;
  const allTabs = ["Популярное", "Поток", "Прижился", ...customTopics];

  // --- ЧТЕНИЕ ИЗ SQL БАЗЫ ДАННЫХ ---
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const fetchData = async () => {
      try {
        const { data: postsData, error: postsError } = await supabase
          .from("posts")
          .select("*")
          .order("id", { ascending: false });

        if (postsData && !postsError) {
          setPosts(postsData);
          const uniqueTopics = [];
          postsData.forEach(post => {
            if (post.category !== "Популярное" && post.category !== "Поток" && post.category !== "Прижился") {
              if (!uniqueTopics.includes(post.category)) uniqueTopics.push(post.category);
            }
          });
          setCustomTopics(uniqueTopics);
        }
      } catch (e) {
        console.log("Ожидание подключения к SQL...");
      }
    };
    fetchData();
  }, [screen]);

  useEffect(() => {
    if (user) localStorage.setItem("df_user", JSON.stringify(user));
    else localStorage.removeItem("df_user");
  }, [user]);

  useEffect(() => {
    if (user && screen === "welcome") setScreen("forum");
  }, [user, screen]);

  const availableColors = [
    { id: "text-emerald-400", name: "Изумрудный" },
    { id: "text-red-500", name: "Багровый" },
    { id: "text-cyan-400", name: "Лазурный" },
    { id: "text-pink-400", name: "Розовый" },
    { id: "text-amber-400", name: "Янтарный" },
    { id: "text-slate-200", name: "Пепельный" },
  ];

  const handleAuthSubmit = (e) => {
    e.preventDefault();
    if (isRegistering && !authForm.username.trim()) return;
    
    if (authForm.password.length < 6) {
      alert("Ошибка безопасности: пароль должен содержать не менее 6 символов.");
      return; 
    }
    
    const derivedName = isRegistering ? authForm.username : authForm.email.split("@")[0];
    
    setUser({
      username: derivedName,
      email: authForm.email,
      color: "text-slate-200",
      msgCount: user?.msgCount || 0 
    });
    setScreen("forum");
  };

  const handleLogout = () => {
    setUser(null);
    setAuthForm({ username: "", email: "", password: "" });
    setScreen("welcome");
  };

  const executeSubmitPost = async () => {
    if (!newPost.trim()) return;
    if (!user) {
      alert("Ошибка: оставлять мысли в потоке могут только авторизованные авторы.");
      return;
    }
    if (activeCategory === "Прижился" && user.msgCount < 10) return;

    const updatedMsgCount = user.msgCount + 1;
    const currentSubCat = activeCategory === "Популярное" ? popularSubCategory : null;
    const cleanAuthorName = String(user.username);

    const localNewPost = {
      id: Date.now(),
      author: cleanAuthorName,
      authorColor: user.color,
      authorMsgCount: updatedMsgCount, 
      content: newPost,
      category: activeCategory,
      subCategory: currentSubCat || undefined,
      likes: 0,
      likedBy: []
    };

    setPosts((prev) => [localNewPost, ...prev]);
    setUser(prev => ({ ...prev, msgCount: updatedMsgCount }));
    const textToSend = newPost;
    setNewPost("");

    if (isSupabaseConfigured) {
      try {
        await supabase.from("posts").insert([
          {
            author: cleanAuthorName,
            authorColor: user.color,
            authorMsgCount: updatedMsgCount,
            content: textToSend,
            category: activeCategory,
            subCategory: currentSubCat,
            likes: 0,
            likedBy: []
          }
        ]);
      } catch (err) {
        console.error("Ошибка записи в SQL");
      }
    }
  };

  const handleCreateTopic = (e) => {
    e.preventDefault();
    if (!user) {
      alert("Ошибка доступа: создавать новые пространства мысли могут только авторизованные авторы.");
      setShowTopicModal(false);
      return;
    }
    if (!newTopicName.trim()) return;

    const cleanTopicName = newTopicName.trim();
    if (!customTopics.includes(cleanTopicName)) setCustomTopics((prev) => [...prev, cleanTopicName]);
    setActiveCategory(cleanTopicName);
    setNewTopicName("");
    setShowTopicModal(false);
  };

  const handleLike = async (postId) => {
    if (!user) {
      alert("Ошибка: оценивать чужие суждения могут только авторизованные авторы.");
      return;
    }
    let updatedPostObj = null;
    const updatedPosts = posts.map((post) => {
      if (post.id !== postId) return post;
      const hasLiked = post.likedBy?.includes(user.username);
      const updatedLikedBy = hasLiked
        ? post.likedBy.filter((name) => name !== user.username)
        : [...(post.likedBy || []), user.username];

      updatedPostObj = { ...post, likes: hasLiked ? post.likes - 1 : post.likes + 1, likedBy: updatedLikedBy };
      return updatedPostObj;
    });

    setPosts(updatedPosts);

    if (isSupabaseConfigured && updatedPostObj) {
      try {
        await supabase.from("posts").update({ likes: updatedPostObj.likes, likedBy: updatedPostObj.likedBy }).eq("id", postId);
      } catch (e) {
        console.error("Ошибка обновления лайков в SQL");
      }
    }
  };

  const handleColorChange = (colorId) => {
    if (!user) return;
    setUser((prev) => ({ ...prev, color: colorId }));
    setPosts((prevPosts) => prevPosts.map((p) => p.author === user.username ? { ...p, authorColor: colorId } : p));
  };

  const handleReply = (authorName) => {
    if (!user) {
      alert("Ошибка: отвечать авторам могут только зарегистрированные пользователи.");
      return;
    }
    setNewPost((prev) => `@${authorName}, ${prev}`);
    const textarea = document.getElementById("post-textarea");
    if (textarea) textarea.focus();
  };

  let filteredPosts = posts.filter(post => post.category === activeCategory);
  if (activeCategory === "Популярное") {
    filteredPosts = filteredPosts.filter(post => post.subCategory === popularSubCategory).sort((a, b) => b.likes - a.likes);
  }

  const myPosts = user ? posts.filter(post => post.author === user.username) : [];

  const smokeAnimationStyles = `
    @keyframes deepSmoke {
      0% { text-shadow: 0 0 1px rgba(255,255,255,0); opacity: 0.9; filter: blur(0px); }
      30% { text-shadow: -2px -4px 6px rgba(240,240,240,0.5), 2px -6px 10px rgba(200,200,200,0.3); filter: blur(0.4px); }
      60% { text-shadow: 3px -5px 8px rgba(255,255,255,0.6), -3px -9px 14px rgba(130,130,130,0.4); opacity: 1; filter: blur(0.2px); }
      100% { text-shadow: 0 0 1px rgba(255,255,255,0); opacity: 0.9; filter: blur(0px); }
    }
    .smoke-effect { animation: deepSmoke 4s infinite ease-in-out; display: inline-block; }
  `;

  // ================= ЭКРАН 1: ПРИВЕТСТВИЕ =================
  
  if (screen === "welcome") {
    return (
      <div className="min-h-screen bg-black flex justify-center text-white font-serif selection:bg-zinc-700/50 w-full overflow-x-hidden">
        <style>{smokeAnimationStyles}</style>
        {/* ИЗМЕНЕНО: max-w-7xl mx-auto разжимает приветственный экран по краям монитора ПК */}
        <div 
          className="w-full max-w-7xl min-h-screen bg-cover bg-center relative flex flex-col justify-between px-6 md:px-12 py-8 border-x border-zinc-900/50 mx-auto" 
          style={{ backgroundImage: `linear-gradient(to bottom, rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.7)), url('/backphone.jpg')` }}
        >
          <header className="flex justify-between items-center text-zinc-200 text-xs tracking-widest uppercase z-10 w-full border-b border-zinc-900/40 pb-4">
            <button onClick={() => { setIsRegistering(false); setScreen("auth"); }} className="hover:text-white transition cursor-pointer">Аккаунт</button>
            <div className="flex gap-6">
              <button onClick={() => { setActiveCategory("Популярное"); setScreen("forum"); }} className="hover:text-white transition cursor-pointer">Популярное</button>
              <button onClick={() => { setActiveCategory("Поток"); setScreen("forum"); }} className="hover:text-white transition cursor-pointer">Поток</button>
            </div>
          </header>

          {/* Добавлена центрированная структура для больших ПК-экранов */}
          <div className="my-auto space-y-12 max-w-2xl z-10 md:pl-6">
            <p className="text-zinc-200 text-lg md:text-2xl leading-relaxed font-light tracking-wide italic font-serif">
              Вы никогда не думали, что вы не одни кому хотелось бы поделиться своим дневником...мыслями...
            </p>
            <p className="text-zinc-300 text-xs md:text-sm tracking-widest uppercase font-light leading-loose">
              это место <br /> создано для вас
            </p>
          </div>

          <div className="text-center space-y-2 mt-auto z-10 border-t border-zinc-900/40 pt-4 w-full">
            <p className="text-zinc-400 text-[10px] tracking-widest uppercase font-light">Добро пожаловать на</p>
            <h1 className="text-lg md:text-xl font-normal tracking-[0.3em] uppercase text-white">мысли онлайн</h1>
          </div>
        </div>
      </div>
    );
  }


  // ================= ЭКРАН 2: АВТОРИЗАЦИЯ =================
  if (screen === "auth") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black relative px-4 font-serif w-full overflow-x-hidden" style={{ backgroundImage: `linear-gradient(to bottom, rgba(0, 0, 0, 0.8), rgba(0, 0, 0, 0.9)), url('/backphone.jpg')` }}>
        <div className="w-full max-w-sm bg-zinc-950 border border-zinc-900 rounded-xl p-5 shadow-xl">
          <div className="flex flex-col items-center mb-5 text-center"><h1 className="text-base font-bold text-white tracking-[0.2em] uppercase">МЫСЛИ ОНЛАЙН</h1></div>
          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {isRegistering && (
              <div>
                <label className="block text-[9px] text-zinc-500 mb-1 uppercase tracking-wider">Никнейм</label>
                <input type="text" required placeholder="username" value={authForm.username} onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-2 px-3 text-xs text-zinc-200 outline-none" />
              </div>
            )}
            <div>
              <label className="block text-[9px] text-zinc-500 mb-1 uppercase tracking-wider">Email</label>
              <input type="email" required placeholder="email@mail.com" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-2 px-3 text-xs text-zinc-200 outline-none" />
            </div>
            <div>
              <label className="block text-[9px] text-zinc-500 mb-1 uppercase tracking-wider">Пароль (мин. 6 симв.)</label>
              <input type="password" required placeholder="••••••••" value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-2 px-3 text-xs text-zinc-200 outline-none" />
            </div>
            <button type="submit" className="w-full bg-zinc-100 text-zinc-950 font-medium py-2 rounded-lg text-[10px] uppercase tracking-wider mt-1">
              {isRegistering ? "Создать аккаунт" : "Войти"}
            </button>
          </form>
          <div className="mt-4 flex justify-between text-[10px]">
            <button onClick={() => setScreen("welcome")} className="text-zinc-500 hover:text-zinc-400">← Назад</button>
            <button onClick={() => setIsRegistering(!isRegistering)} className="text-zinc-400 underline">{isRegistering ? "Войти" : "Регистрация"}</button>
          </div>
        </div>
      </div>
    );
  }

  // ================= ЭКРАН 4: ЛИЧНЫЙ КАБИНЕТ (РАСТЯНУТЫЙ ПК-АДАПТИВ) =================
  if (screen === "profile" && user) {
    const myRank = getUserRankInfo(user.msgCount);
    return (
      <div className="min-h-screen bg-black flex justify-center text-white font-serif selection:bg-zinc-800 w-full overflow-x-hidden">
        <style>{smokeAnimationStyles}</style>
        {/* ИЗМЕНЕНО: max-w-7xl mx-auto разжимает личный кабинет по краям экрана */}
        <div className="w-full max-w-7xl min-h-screen bg-cover bg-center bg-no-repeat bg-fixed relative flex flex-col px-6 md:px-12 py-8 border-x border-zinc-900/50 mx-auto" style={{ backgroundImage: `linear-gradient(to bottom, rgba(0, 0, 0, 0.9), rgba(0, 0, 0, 0.95)), url('/backphone.jpg')` }}>
          <header className="flex justify-between items-center text-zinc-400 text-xs tracking-widest uppercase mb-8 z-10">
            <button onClick={() => setScreen("forum")} className="hover:text-white transition flex items-center gap-1.5 cursor-pointer"><ArrowLeft className="w-3.5 h-3.5" /> Назад в поток</button>
            <span className="text-white tracking-[0.15em]">Кабинет мыслей</span>
            <button onClick={handleLogout} className="text-red-500/80 hover:text-red-400 transition cursor-pointer">Выйти</button>
          </header>
          <div className="space-y-6 z-10 mb-8 pb-6 border-b border-zinc-900">
            <div className="flex items-center gap-4">
              <span className="text-3xl filter drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">{myRank.avatar}</span>
              <div>
                <h2 className={`text-xl font-medium tracking-wide ${user.color} ${myRank.isSmoking ? "smoke-effect" : ""}`}>{user.username}</h2>
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Статус духовного пути: {myRank.label}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-zinc-950/40 border border-zinc-900 p-4 rounded-xl flex items-center gap-3">
                <FileText className="w-5 h-5 text-zinc-500" />
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">Ваши мысли</p>
                  <p className="text-base font-medium text-zinc-200">{user.msgCount}</p>
                </div>
              </div>
              <div className="bg-zinc-950/40 border border-zinc-900 p-4 rounded-xl flex items-center justify-center text-center">
                <div className="text-xs text-zinc-500 font-mono">{myRank.nextText}</div>
              </div>
            </div>
            <div className="space-y-2.5">
              <label className="block text-[10px] uppercase tracking-widest text-zinc-500">Выбрать цвет своей ауры:</label>
              <div className="flex flex-wrap gap-2">
                {availableColors.map((color) => (
                  <button key={color.id} onClick={() => handleColorChange(color.id)} className={`px-3 py-1.5 text-xs rounded-lg border transition font-medium ${user.color === color.id ? "bg-zinc-900 border-zinc-700" : "bg-transparent border-zinc-900/60"} ${color.id}`}>{color.name}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex-1 flex flex-col z-10 min-h-0">
            <h3 className="text-xs uppercase tracking-widest text-zinc-500 mb-4 font-medium">Архив записей</h3>
            <div className="flex-1 space-y-6 overflow-y-auto pr-1 scrollbar-none">
              {myPosts.map((post) => (
                <div key={post.id} className="space-y-1 border-b border-zinc-900/40 pb-4">
                  <span className="text-[9px] text-zinc-500 uppercase tracking-wider">Раздел: {post.category}</span>
                  <p className="text-zinc-300 text-sm italic font-light leading-relaxed">{post.content}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ================= ЭКРАН 3: ГЛАВНАЯ ЛЕНТА (РАСТЯНУТЫЙ ПК-АДАПТИВ) =================
  return (
    <div className="min-h-screen bg-black flex justify-center text-white font-serif selection:bg-zinc-800 w-full overflow-x-hidden">
      <style>{smokeAnimationStyles}</style>
      {/* ИЗМЕНЕНО: max-w-7xl mx-auto раскрывает ленту постов на всю ширину ПК-экрана */}
      <div className="w-full max-w-7xl min-h-screen bg-cover bg-center bg-no-repeat bg-fixed relative flex flex-col px-4 md:px-12 py-6 border-x border-zinc-900/50 mx-auto" style={{ backgroundImage: `linear-gradient(to bottom, rgba(0, 0, 0, 0.85), rgba(0, 0, 0, 0.92)), url('/backphone.jpg')` }}>
        
        <header className="flex flex-col sm:flex-row gap-3 justify-between sm:items-center text-zinc-400 text-[10px] tracking-widest uppercase mb-6 z-10 border-b border-zinc-900 pb-3">
          <div className="flex justify-between items-center w-full sm:w-auto">
            {user ? (
              <button onClick={() => setScreen("profile")} className={`hover:underline cursor-pointer font-medium tracking-normal flex items-center gap-1.5 ${user.color} ${userRank.isSmoking ? "smoke-effect" : ""}`}>
                <span className="text-xs filter drop-shadow-[0_0_4px_rgba(255,255,255,0.15)]">{userRank.avatar}</span>
                <span>@{user.username}</span>
              </button>
            ) : (
              <div className="flex gap-3 text-[10px]">
                <button onClick={() => setScreen("welcome")} className="text-zinc-400 hover:text-white transition cursor-pointer">← На главную</button>
                <button onClick={() => { setIsRegistering(false); setScreen("auth"); }} className="text-amber-400 hover:text-amber-300 transition cursor-pointer">Войти в аккаунт</button>
              </div>
            )}
            <button onClick={() => { if(!user) { alert("Ошибка: Гости не могут создавать темы"); return; } setShowTopicModal(true); }} className="p-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 sm:hidden"><Plus className="w-3 h-3" /></button>
          </div>
          
          <div className="flex items-center justify-between w-full sm:w-auto gap-4">
            <div className="flex gap-1 overflow-x-auto scrollbar-none py-1 max-w-[260px] sm:max-w-xs">
              {allTabs.map((cat) => (
                <button key={cat} onClick={() => setActiveCategory(cat)} className={`transition px-1.5 py-0.5 rounded whitespace-nowrap text-[9px] ${activeCategory === cat ? "text-white underline" : "text-zinc-500"}`}>{cat === "Прижился" && (user?.msgCount || 0) < 10 ? "🔒 Прижился" : cat}</button>
              ))}
            </div>
            <button onClick={() => { if(!user) { alert("Ошибка: Гости не могут создавать темы"); return; } setShowTopicModal(true); }} className="p-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 hidden sm:block cursor-pointer"><Plus className="w-3 h-3" /></button>
          </div>
        </header>

        {showTopicModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 w-full max-w-sm font-serif">
              <h3 className="text-xs uppercase tracking-widest text-zinc-300 mb-3">Создать тему обсуждения</h3>
              <form onSubmit={handleCreateTopic} className="space-y-3">
                <input type="text" required maxLength={20} placeholder="Название пространства (например, Нигилизм)" value={newTopicName} onChange={(e) => setNewTopicName(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-2 px-3 text-xs text-zinc-200 outline-none" />
                <div className="flex justify-end gap-2 text-[10px] uppercase">
                  <button type="button" onClick={() => setShowTopicModal(false)} className="text-zinc-500">Отмена</button>
                  <button type="submit" className="px-3 py-1 bg-zinc-100 text-zinc-950 font-medium rounded-md">Создать</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {activeCategory === "Популярное" && (
          <div className="flex justify-center gap-4 mb-4 z-10 border-b border-zinc-900 pb-2 text-[10px] tracking-widest uppercase">
            {["Бред", "Обыденность", "Вульгарность"].map((sub) => (
              <button key={sub} onClick={() => setPopularSubCategory(sub)} className={`transition font-light flex items-center gap-0.5 ${popularSubCategory === sub ? "text-amber-400 font-normal" : "text-zinc-600"}`}>{popularSubCategory === sub && <Trophy className="w-2.5 " />}{sub}</button>
            ))}
          </div>
        )}

        {isSectionLocked ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 z-10">
            <EyeOff className="w-6 h-6 text-zinc-700 mb-2" />
            <h2 className="text-xs font-medium tracking-widest text-zinc-400 uppercase">Доступ ограничен</h2>
            <p className="text-[11px] text-zinc-500 italic max-w-xs mt-1">Раздел «Прижился» откроется после 10 мыслей. Ваш след: {user?.msgCount || 0}/10.</p>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-6 overflow-y-auto mb-4 pr-1 z-10 scrollbar-none">
              {filteredPosts.map((post) => {
                const postRank = getUserRankInfo(post.authorMsgCount || 0);
                const userHasLiked = post.likedBy?.includes(user?.username);
                return (
                  <div key={post.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs">{postRank.avatar}</span>
                        <span className={`text-xs font-medium ${post.authorColor} ${postRank.isSmoking ? "smoke-effect" : ""}`}>{post.author}</span>
                        <span className="text-[8px] text-zinc-600 font-mono">({postRank.label})</span>
                      </div>
                      <button onClick={() => handleLike(post.id)} className={`text-[10px] font-mono flex items-center gap-0.5 ${userHasLiked ? "text-white" : "text-zinc-600"}`}><span>🪞</span><span>{post.likes || 0}</span></button>
                    </div>
                    <p className="text-zinc-300 text-xs sm:text-sm leading-relaxed italic font-light pl-5 whitespace-pre-wrap">{post.content}</p>
                    <div className="pl-5"><button onClick={() => handleReply(post.author)} className="text-[9px] text-zinc-600 uppercase tracking-wider">ответить</button></div>
                  </div>
                );
              })}
              {filteredPosts.length === 0 && <div className="text-center py-8 text-zinc-600 text-xs italic z-10">В этой секции пока нет мыслей...</div>}
            </div>

            <div className="mt-auto pt-3 border-t border-zinc-900/60 bg-black/40 backdrop-blur-md z-10">
              <form onSubmit={(e) => { e.preventDefault(); executeSubmitPost(); }} className="flex gap-2 items-end">
                <input
                  id="post-textarea"
                  type="text"
                  enterKeyHint="send"
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  placeholder={!user ? "Авторизуйтесь для публикации..." : activeCategory === "Популярное" ? "Оставить мысль в Топе..." : "Оставить мысль в потоке..."}
                  disabled={!user}
                  className="w-full bg-transparent border-b border-zinc-800 py-1.5 text-xs text-zinc-300 placeholder-zinc-700 outline-none h-8 focus:border-zinc-600 transition font-sans disabled:opacity-50"
                />
                <button type="submit" disabled={!user} className="text-[9px] uppercase tracking-widest bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 px-3 py-1.5 rounded-md transition whitespace-nowrap disabled:opacity-50">Сказать</button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
