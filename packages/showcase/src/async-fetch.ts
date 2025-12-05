/**
 * Async Fetch Sample - Vue-like API with function-style UI
 *
 * Demonstrates:
 * - Async operations with watchEffect
 * - Reactive state management with ref()
 * - onKey lifecycle hook for keyboard events
 * - Function-style UI composition
 * - Loading and error states
 */

import { createApp, ref, onKey, onMounted, type KeyEvent } from "btuin";
import { VStack, HStack, Box, Paragraph } from "btuin/elements";
import { Table } from "@btuin/table";

interface Post {
  userId: number;
  id: number;
  title: string;
  body: string;
}

const app = createApp({
  setup() {
    const posts = ref<Post[]>([]);
    const selectedIndex = ref(0);
    const loading = ref(false);
    const error = ref<string | null>(null);
    const lastFetchTime = ref<string | null>(null);

    const fetchPosts = async () => {
      loading.value = true;
      error.value = null;

      try {
        const response = await fetch("https://jsonplaceholder.typicode.com/posts");

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = (await response.json()) as Post[];
        posts.value = data;
        lastFetchTime.value = new Date().toLocaleTimeString();
        selectedIndex.value = 0;
      } catch (err) {
        error.value = err instanceof Error ? err.message : "Unknown error";
      } finally {
        loading.value = false;
      }
    };

    // Auto-fetch on mount
    onMounted(() => {
      fetchPosts();
    });

    onKey((key: KeyEvent) => {
      // Quit
      if (key.name === "q") {
        process.exit(0);
      }

      // Navigation
      if ((key.name === "up" || key.name === "j") && posts.value.length > 0) {
        selectedIndex.value = Math.max(0, selectedIndex.value - 1);
        return true;
      }

      if ((key.name === "down" || key.name === "k") && posts.value.length > 0) {
        selectedIndex.value = Math.min(posts.value.length - 1, selectedIndex.value + 1);
        return true;
      }

      // Clear posts
      if (key.name === "c") {
        posts.value = [];
        selectedIndex.value = 0;
        error.value = null;
        return true;
      }

      // Fetch posts
      if (key.name === "f" || key.name === "r") {
        fetchPosts();
        return true;
      }
    });

    return () => {
      const selectedPost = posts.value[selectedIndex.value];
      const hasPosts = posts.value.length > 0;
      const tableRows = posts.value.map((post) => [post.title]);

      return VStack({
        gap: 1,
        children: [
          // Header
          Box({
            outline: { title: "Async Fetch Demo", color: "magenta" },
            height: 5,
            child: VStack({
              gap: 0,
              children: [
                Paragraph({
                  text: "Effect System - Async Operations Demo (Auto-fetch enabled)",
                  align: "center",
                  color: "magenta",
                  height: 1,
                }),
                Paragraph({
                  text: loading.value
                    ? "⏳ Loading posts..."
                    : error.value
                      ? `❌ ${error.value}`
                      : hasPosts
                        ? `✓ ${posts.value.length} posts loaded`
                        : "No posts available",
                  align: "center",
                  color: error.value ? "red" : "gray",
                  height: 1,
                }),
                Paragraph({
                  text: lastFetchTime.value ? `Last fetch: ${lastFetchTime.value}` : "",
                  align: "center",
                  color: "gray",
                  height: 1,
                }),
              ],
            }),
          }),

          // Main content
          HStack({
            gap: 1,
            height: "auto",
            children: [
              // Posts list - Using Table for scrolling
              Box({
                outline: {
                  title: hasPosts
                    ? `Posts (${selectedIndex.value + 1}/${posts.value.length}) - Use ↑↓ to scroll`
                    : "Posts",
                  color: "dodgerblue",
                },
                width: 50,
                child: hasPosts
                  ? Table({
                      rows: tableRows,
                      selectedIndex: selectedIndex.value,
                      focusKey: "posts-table",
                      height: 20,
                    })
                  : Paragraph({
                      text: loading.value
                        ? "Loading posts..."
                        : "No posts yet.\nPress 'f' to fetch.",
                      align: "center",
                      color: "gray",
                    }),
              }),

              // Post detail
              Box({
                outline: { title: "Post Detail", color: "dodgerblue" },
                width: "auto",
                child: selectedPost
                  ? VStack({
                      gap: 1,
                      children: [
                        Paragraph({
                          text: `Title: ${selectedPost.title}`,
                          color: "magenta",
                          height: 2,
                        }),
                        Paragraph({
                          text: `User ID: ${selectedPost.userId} | Post ID: ${selectedPost.id}`,
                          color: "gray",
                          height: 1,
                        }),
                        Paragraph({
                          text: selectedPost.body,
                          height: 10,
                        }),
                      ],
                    })
                      : Paragraph({
                          text: loading.value ? "Loading..." : "Select a post to view details",
                          align: "center",
                          color: "gray",
                        }),
              }),
            ],
          }),

          // Controls
          Box({
            outline: { title: "Controls", color: "dodgerblue" },
            height: 7,
            child: VStack({
              gap: 0,
              children: [
                Paragraph({
                  text: "[f] Fetch posts from API",
                  color: "white",
                  height: 1,
                }),
                Paragraph({
                  text: "[↑/j] Previous post  [↓/k] Next post",
                  color: "white",
                  height: 1,
                }),
                Paragraph({
                  text: "[c] Clear posts  [r] Retry last fetch",
                  color: "white",
                  height: 1,
                }),
                Paragraph({
                  text: "[q] Quit",
                  color: "gray",
                  height: 1,
                }),
              ],
            }),
          }),
        ],
      });
    };
  },
});

app.mount();
