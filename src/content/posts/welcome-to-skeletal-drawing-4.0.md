---
title: Welcome to Skeletal Drawing 4.0!
date: 2026-07-22T13:29
kind: ''
excerpt: Welcome to the completely overhauled SkeletalDrawing.com. For the last month and a half I've been working on a ground-up overhaul of the website. I'd like to explain a bit of what's changed and why, how it benefits you, the visitor, and what to expect in the future...
image:
  src: /images/blog/mobilewebsite.jpg
  alt: A close up of a hand holding a smartphone, showing off the new mobile experience of this website
featured: false
draft: true
---

## Welcome to the completely overhauled SkeletalDrawing.com 

For the last month and a half I've been working on a ground-up overhaul of the website. I'd like to explain a bit of what's changed and why, how it benefits you, the visitor, and what to expect in the future.

### **Why the change?**

The site has [changed a few times](https://www.skeletaldrawing.com/home/2013/6/19/welcome-to-the-redesigned-skeletaldrawingcom), as any website that is 22 years old must do to stay relevant. Prior overhauls tried to improve aesthetics, and were especially aimed at making the website easier to add content to. That culminated in the SquareSpace hosted website that launched in 2013, whose design and technology stack stayed essentially the same until I flipped the switch on this new one.

I realize that isn't a reason. To be sure, I wanted to refresh the design to make it a bit more contemporary, and while the blog will continue, I wanted the site to not feel so dominated by it, especially when many visitors just want to find a skeletal or two. 

But there were also several functional limitations I wasn't happy with. Flexible, Content Management System-based, dynamic websites come with tradeoffs: Loading performance was slow, especially for the largest skeletal galleries. Despite a template that was supposed to be mobile-friendly, performance on phones was never a good experience - and this is reflected in visitation numbers. While 55-60% of all web traffic is mobile, 2/3 of my monthly traffic stayed on desktop. And finding specific skeletals was harder than it should be - the galleries were slow to scroll through, the site-wide search was terrible, and because individual images in the galleries didn't index well, you couldn't even rely on Google to find them for you.

![A circle chart showing the visitorship rate from desktop, tablets and mobile](/images/blog/squarespace-visitorship.png "That's not many desktop visitors for June, 2026.")

To be fair to SquareSpace, the template the website was based on had to also be at least 13 years old. They've overhauled their template engine several times, and the new ones at least _look_ like they allow better mobile design. But I'm not sure if the other issues could be fixed, and more importantly, when I attempted to update the site to the new 7.1 templates, it broke everything. I'd either be starting from scratch or I'd have to hire someone to port over many hundreds of images, pages and blog posts. I can't afford that! So if I was going to have to start from scratch anyhow...

### **So how does this fix it?**

I completely switch the backend (what web designers like to refer to as the _technology stack_). For those who are interested in such things, this is now a static website, built on the Astro framework, and served by Cloudflare. I'm using the Sveltia CMS to write content - like this post, right now! 

But for you, the visitor, it means everything is pre-rendered and optimized for whatever device you are currently using. So it should all load lickety-split - even the largest galleries (which we all know is the [theropod gallery](https://skeletaldrawing.pages.dev/theropods/)). The galleries are also touchscreen friendly, can be filtered phylogenetically or by animal length, and I've got an interactive search tool that is fast and finds everything available. Please feel free to try them out!

There are of course new and updated skeletals in the galleries now (we're launching with 286 images of 259 species), but there's also a lot more information available. All animals have scale bars and length estimates, and for species with multiple individuals drawn, there's now a hub that gives  you comparative information and access to all of them - no more having to crowd every [_T. rex_ skeleton](https://skeletaldrawing.pages.dev/theropods/tyrannosaurus-rex/) onto a single image frame. 

And finally, since I control the technology stack, I don't ever have to allow advertising, and there will never be any form of ID tracking on this website. Of course the web is a big place, and I can't promise you the site you came from or leave to won't, or that your browser or operating system aren't doing those things right now - but I'm not!

### Please leave feedback! But about that...

There is one potential downside to this, and it's how commenting works now. All of the comments from my prior site (and my Blogger posts before that) have been ported over, so conversations between visitors, myself and other professionals have all been preserved (and all spam has been removed), as a static comment archive under the appropriate blog posts. 

But I had to dump Disqus. While I appreciated how easy the Disqus comment system was to set up and use, it meant everyone had to tolerate bad, slow ads at the bottom of every blog post, and probably targeted tracking if you logged in to comment. Now your comment passes an anonymous Cloudflare spam filter, gets forwarded to me and I pass it on, but the website has to regenerate and you'll have to refresh your screen to see the post show up.

Right now, that takes 8-12 minutes on average, which isn't long in the big scheme of things, but feels like forever if you really want to see how your response looks when it lands. There are a few things that can potentially speed this up. Visitors to this site have always been kind to one another, so If the spam filter catches most everything, in a few weeks I'll switch the posting from moderated to automatic, which will save some time. There is also some potential to shave rebuild time with image caching, but that may take a couple of weeks to implement, as initially I want to make sure everything works as it is now, to fix anything that breaks, address feedback, etc. But hopefully we can eventually get the wait down to a handful of minutes.

If that simply isn't going to work for you, say so (even if you can to wait until you can see your feedback post...). There are other potential implementations, but the all come with tradeoffs (and of course are more work). I'm hoping a secure, ad-free posting experience is worth it, but I'm open to other possibilities. 

Enjoy!
