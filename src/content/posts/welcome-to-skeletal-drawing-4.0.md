---
title: Welcome to Skeletal Drawing 4.0!
date: 2026-07-22T13:29
kind: ''
excerpt: Welcome to the completely overhauled SkeletalDrawing.com. For the last month and a half I've been working on a ground-up overhaul of the website. I'd like to explain a bit of what's changed and why, how it benefits you, the visitor, and what to expect in the future...
image:
  src: /images/blog/mobilewebsite.jpg
  alt: A close up of a hand holding a smartphone, showing off the new mobile experience of this website
featured: false
draft: false
---

## Welcome to the completely overhauled SkeletalDrawing.com 

For the last month and a half I've been working on a complete overhaul of the website. I'd like to explain a bit of what's changed, why, how it benefits you, the visitor. I also want to explain how the blog comments are changing, and what to expect in the future.

### **Why the change?**

From a technology standpoint, this is the fourth incarnation of the site (I [detailed that history](/blog/welcome-to-the-redesigned-skeletaldrawingcom/) the last time I overhauled the site). But that's something any website that is 22 years old must do to stay relevant. While prior overhauls tried to improve aesthetics, they were especially aimed at making the website easier to add content to. That culminated in the SquareSpace hosted website that launched in 2013, whose design and technology stack stayed essentially the same until I flipped the switch to launch this one.

I realize that isn't a reason. To be sure, I wanted to refresh the design to make it a bit more contemporary, and while the blog will continue, I wanted the site to feel less dominated by it, especially when many visitors just want to find a specifical osteograph or two. 

But the previous version also had several limitations I wasn't happy with. It turns out that dynamically served, Content Management System-based websites come with tradeoffs: Loading performance was slow, especially for the largest skeletal galleries. Locating specific skeletals was harder than it should be - the galleries were slow to scroll through, the site-wide search was terrible, and because individual images in the galleries didn't index well you couldn't even rely on Google to find them for you. Finally, despite templates advertised as "mobile-friendly", navigation on phones was never a good experience. This is reflected in visitation numbers. While 55-60% of all modern web traffic is mobile, 2/3 of my monthly traffic stayed on desktop browsers. 

![A circle chart showing the visitorship rate from desktop, tablets and mobile](/images/blog/squarespace-visitorship.png "That's not many desktop visitors for June, 2026."){width=50% left}

To be fair to SquareSpace, the template the website was based on was _also_ at least 13 years old. They've overhauled their template engine three times since then, and the new Fluid Engine templates at least _look_ like they allow better mobile design. I'm not sure if my other objections could be fixed, but more importantly, my design template is so old that when I attempted to update the site it broke _everything_. I'd either have had to start from scratch or hire someone to port over hundreds of images, pages and blog posts, and existing comments. I can't afford that! So if I was going to have to start from scratch anyhow...

### **The new website**

The new site was rewritten from the ground up, with a completely new backend (what web designers refer to as the _technology stack_). For those who are interested in such things, this is now a static website, built on the Astro framework and served by Cloudflare. I'm using the Sveltia CMS to write content - like this post, right now! 

### **So what does this do for me?**

For you, the visitor, it means everything is now pre-rendered and optimized for whatever device you are currently using. Everything should load lickety-split - even the largest galleries (which we all know is the [theropod gallery](https://skeletaldrawing.pages.dev/theropods/)). Everything is now touchscreen friendly, the galleries can be filtered phylogenetically or by animal length (I dare say they are even fun to browse now), and I've got [fully integrated, interactive search](https://skeletaldrawing.pages.dev/skeletals/) that is blazing fast and finds everything that is relevant. Give them a whirl, and let me know what you think!

There are of course new and updated skeletals (including that [_Edaphosaurus_](https://skeletaldrawing.pages.dev/synapsids/edaphosaurus-pogonias/) some of you are waiting on). I dare say this has helped reinvigorate me for drawing skeletals, so while the new site is launching with 286 images of 259 species, you can expect more this summer (and fall...and winter...). There's also a lot more information available with each skeletal. All animals have scale bars and length estimates, some basic information and a brief phylogenetic breakdown. For species with multiple individuals drawn, there are hubs that give you access to all of them - no more having to crowd every [_T. rex_ skeleton](https://skeletaldrawing.pages.dev/theropods/tyrannosaurus-rex/) onto a single image. 

And finally, since I control the technology stack, I don't ever have to allow advertising, and there will never be any form of ID tracking. Of course the web is a big place, and I can't promise you the site you came from or leave to won't track you, or that your browser or operating system aren't doing that right now - but I'm not!

![Silhouette size comparison of a juvenile and subadult Allosaurus to adult and juvenile humans](/images/blog/comparison.png "This silhouette size comparison pipeline might be useful for additional features...")

### Please leave feedback! But about that...

There is one potential downside to this technology stack, and it's how commenting works. All of the comments from my prior site (and my Blogger posts before that) have been ported over, so existing conversations between visitors, myself and/or visiting professionals have all been preserved as static comment archives below existing blog posts. 

But I had to dump Disqus. While I appreciated how easy the Disqus comment system is to implement, using it slowed down loading, meant everyone had to tolerate garbage ads at the bottom of every blog post, and probably targeted tracking if you logged in to comment. Now your comment passes an anonymous Cloudflare spam filter, gets forwarded to me to approve, and then gets posted... except as a static website, it has to regenerate for each new comment to appear, and when it's ready you'll have to refresh the page to see it show up.

Now the bad news: Right now, that takes 8-12 minutes after approval. Which isn't long in the big scheme of things, but probably feels like forever if you _really_ want to see how your response looks when it lands. There are a few things that can potentially speed this up. Visitors to this site have always been kind to one another, so If the spam filter does its job well-enough, in a few weeks I'll switch the comments from moderated to automatic, which will save time when I'm not available. There is potential to shave rebuild times significantly with image caching, but that may take a couple of weeks to implement, as initially I want to concentrate on fix anything that breaks, addressing important feedback, and other bugaboos that go with launching a new site. But hopefully when that settles down, it will be possible to get the wait time for a post down to a handful of minutes.

If that simply isn't going to work for you, say so. If you prefer, you can also send feedback via [the contact form.](https://skeletaldrawing.pages.dev/contact/) There are other potential commenting implementations, but they all come with tradeoffs. I'm hoping a secure, ad-free posting experience will be worth it, but I'm open to other possibilities. 

Either way, enjoy!
